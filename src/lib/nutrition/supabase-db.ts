//src\lib\nutrition\supabase-db.ts
import { createClient } from '@supabase/supabase-js';
import { FoodItem, NutritionData, DatabaseFoodItem } from '@/types/nutrition';
import { FoodAnalysisError, ErrorCode } from '@/lib/errors/food-analysis-error';

// Supabaseの接続情報
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Supabaseに接続して食品データベースを操作するクラス
 */
export class SupabaseFoodDatabase {
    private static instance: SupabaseFoodDatabase;
    private supabase;
    private foodCache: Map<string, DatabaseFoodItem> = new Map();
    private foodAliasesMap: Map<string, string[]> = new Map();
    private cacheLastRefreshed: Date | null = null;
    private readonly CACHE_VALIDITY_PERIOD = 30 * 60 * 1000; // 30分のキャッシュ有効期間
    private forceNextRefresh = false;

    /**
     * コンストラクタ（シングルトンパターン）
     */
    private constructor() {
        console.log('SupabaseFoodDatabase: インスタンス作成開始');

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('SupabaseFoodDatabase: Supabase設定が不足しています');
            throw new Error('Supabase設定が不足しています');
        }

        try {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('SupabaseFoodDatabase: Supabaseクライアント初期化成功');
        } catch (error) {
            console.error('SupabaseFoodDatabase: Supabaseクライアント初期化エラー:', error);
            throw new Error('Supabaseクライアントの初期化に失敗しました');
        }
    }

    /**
     * インスタンス取得（シングルトンパターン）
     */
    public static getInstance(): SupabaseFoodDatabase {
        if (!SupabaseFoodDatabase.instance) {
            SupabaseFoodDatabase.instance = new SupabaseFoodDatabase();
        }
        return SupabaseFoodDatabase.instance;
    }

    /**
     * キャッシュの有効性を確認
     * @private
     */
    private isCacheValid(): boolean {
        if (!this.cacheLastRefreshed) return false;

        const now = new Date();
        const elapsed = now.getTime() - this.cacheLastRefreshed.getTime();
        return elapsed < this.CACHE_VALIDITY_PERIOD;
    }

    /**
     * キャッシュの更新
     */
    public async refreshCache(): Promise<void> {
        console.log('SupabaseFoodDatabase: キャッシュ更新開始');

        // キャッシュが有効でも、強制更新フラグがある場合は再読み込み
        const forceRefresh = this.forceNextRefresh;
        this.forceNextRefresh = false;

        if (this.isCacheValid() && this.foodCache.size > 0 && !forceRefresh) {
            console.log(`SupabaseFoodDatabase: キャッシュは有効です - スキップ (キャッシュサイズ: ${this.foodCache.size})`);
            return;
        }

        try {
            // 食品データ取得
            const { data: foodData, error: foodError } = await this.supabase
                .from('food_items')
                .select('*');

            if (foodError) {
                console.error('SupabaseFoodDatabase: 食品データ取得エラー:', foodError);
                throw foodError;
            }

            if (!foodData || foodData.length === 0) {
                console.warn('SupabaseFoodDatabase: 食品データが見つかりません');
                return;
            }

            // 食品エイリアス取得
            const { data: aliasData, error: aliasError } = await this.supabase
                .from('food_aliases')
                .select('*');

            if (aliasError) {
                console.error('SupabaseFoodDatabase: 食品エイリアス取得エラー:', aliasError);
                // エイリアスエラーは致命的ではないため、続行
            }

            // キャッシュをクリア
            this.foodCache.clear();
            this.foodAliasesMap.clear();

            // 食品データをキャッシュに格納
            for (const food of foodData) {
                // Supabaseから取得したデータをDatabaseFoodItem形式に変換
                const foodItem: DatabaseFoodItem = {
                    name: food.name,
                    calories: food.calories || 0,
                    protein: food.protein || 0,
                    iron: food.iron || 0,
                    folic_acid: food.folic_acid || 0,
                    calcium: food.calcium || 0,
                    vitamin_d: food.vitamin_d || 0,
                    standard_quantity: food.standard_quantity || '100g',
                    cooking_method: food.cooking_method,
                    category_id: food.category_id
                };

                // 正規化した名前をキーとして使用
                const normalizedName = this.normalizeKey(food.name);
                this.foodCache.set(normalizedName, foodItem);
            }

            // エイリアスデータの処理
            if (aliasData) {
                for (const alias of aliasData) {
                    const normalizedAlias = this.normalizeKey(alias.alias);
                    const normalizedTarget = this.normalizeKey(this.getFoodNameById(foodData, alias.food_id));

                    if (!normalizedAlias || !normalizedTarget) {
                        console.warn(`SupabaseFoodDatabase: 不正なエイリアスデータ - ${alias.alias} → ${alias.food_id}`);
                        continue;
                    }

                    // エイリアスマップにエントリがなければ初期化
                    if (!this.foodAliasesMap.has(normalizedTarget)) {
                        this.foodAliasesMap.set(normalizedTarget, []);
                    }

                    // エイリアスを追加
                    const aliases = this.foodAliasesMap.get(normalizedTarget);
                    if (aliases && normalizedAlias && !aliases.includes(normalizedAlias)) {
                        aliases.push(normalizedAlias);
                        console.log(`SupabaseFoodDatabase: エイリアス追加「${alias.alias}」→「${this.getFoodNameById(foodData, alias.food_id)}」`);
                    }
                }

                console.log(`SupabaseFoodDatabase: エイリアス読み込み完了 - ${aliasData.length}件のエイリアス, ${this.foodAliasesMap.size}件の食品にエイリアス割り当て`);
            }

            // キャッシュ更新時間を記録
            this.cacheLastRefreshed = new Date();
            console.log(`SupabaseFoodDatabase: キャッシュ更新完了 - 食品数: ${this.foodCache.size}、エイリアス数: ${this.foodAliasesMap.size}`);
        } catch (error) {
            console.error('SupabaseFoodDatabase: キャッシュ更新エラー:', error);
            throw error;
        }
    }

    /**
     * 食品名を正規化するメソッド（表記揺れに対応）
     * @private
     */
    private normalizeKey(name: string): string {
        if (!name) return '';

        // デバッグ用ログ（重要な変換のみ）
        const originalName = name;

        // 全角を半角に、大文字を小文字に、空白を削除
        let normalized = name.trim()
            .toLowerCase()
            .normalize('NFKC')
            .replace(/\s+/g, '')
            .replace(/[\u3000]/g, '');

        // 表記揺れ対応のマッピング
        const aliasMap: Record<string, string> = {
            '竹輪': 'ちくわ',
            'ちくわ': 'ちくわ',
            'チクワ': 'ちくわ',
            '焼き竹輪': 'ちくわ',
            '焼きちくわ': 'ちくわ',
            '焼チク': 'ちくわ',
            '味噌': 'みそ',
            'みそ': 'みそ',
            'ミソ': 'みそ',
            'とうふ': 'とうふ',
            '豆腐': 'とうふ',
            'トウフ': 'とうふ',
            'じゃがいも': 'じゃがいも',
            'ジャガイモ': 'じゃがいも',
            '馬鈴薯': 'じゃがいも',
            'ポテト': 'じゃがいも',
            'にんじん': 'にんじん',
            'ニンジン': 'にんじん',
            '人参': 'にんじん',
            '玉ねぎ': 'たまねぎ',
            'たまねぎ': 'たまねぎ',
            'タマネギ': 'たまねぎ',
            '玉葱': 'たまねぎ',
            // 他の一般的な表記揺れも追加
        };

        // マッピングテーブルによる正規化
        if (aliasMap[normalized]) {
            const beforeNormalization = normalized;
            normalized = aliasMap[normalized];

            // 変換が発生した場合だけログ出力
            if (beforeNormalization !== normalized) {
                console.log(`SupabaseFoodDatabase: 食品名正規化「${originalName}」→「${normalized}」`);
            }
        }

        return normalized;
    }

    /**
     * 食品IDから食品名を取得するヘルパー関数
     * @private
     */
    private getFoodNameById(foodData: any[], foodId: string): string {
        const food = foodData.find(f => f.id === foodId);
        return food ? food.name : '';
    }

    /**
     * 正確な名前で食品を取得
     */
    public async getFoodByExactName(name: string): Promise<DatabaseFoodItem | null> {
        await this.ensureCacheLoaded();

        const normalizedName = this.normalizeKey(name);

        // 直接キャッシュから検索
        if (this.foodCache.has(normalizedName)) {
            return this.foodCache.get(normalizedName) || null;
        }

        // エイリアスから検索
        for (const [foodName, aliases] of this.foodAliasesMap.entries()) {
            if (aliases.includes(normalizedName)) {
                return this.foodCache.get(foodName) || null;
            }
        }

        return null;
    }

    /**
     * 部分一致で食品を検索
     */
    public async getFoodsByPartialName(name: string, limit: number = 5): Promise<DatabaseFoodItem[]> {
        await this.ensureCacheLoaded();

        const normalizedQuery = this.normalizeKey(name);
        if (!normalizedQuery) return [];

        const results: DatabaseFoodItem[] = [];

        // キャッシュ内の食品名を部分一致で検索
        for (const [key, food] of this.foodCache.entries()) {
            if (key.includes(normalizedQuery)) {
                results.push(food);
                if (results.length >= limit) break;
            }
        }

        // 結果が少ない場合はエイリアスも検索
        if (results.length < limit) {
            for (const [foodName, aliases] of this.foodAliasesMap.entries()) {
                // 既に結果に含まれている食品はスキップ
                if (results.some(f => this.normalizeKey(f.name) === foodName)) continue;

                // エイリアスの部分一致検索
                const matchingAlias = aliases.find(alias => alias.includes(normalizedQuery));
                if (matchingAlias && this.foodCache.has(foodName)) {
                    const food = this.foodCache.get(foodName);
                    if (food) results.push(food);
                    if (results.length >= limit) break;
                }
            }
        }

        return results;
    }

    /**
     * ファジー検索で食品を検索
     */
    public async getFoodsByFuzzyMatch(name: string, limit: number = 5): Promise<Array<{ food: DatabaseFoodItem, similarity: number }>> {
        try {
            const query = name.trim();
            if (!query) return [];

            // デバッグ用のログ追加
            console.log(`SupabaseFoodDatabase: 検索開始「${query}」`);

            // キャッシュ有効な場合はSupabase関数を使わずローカルで検索して高速化
            if (this.isCacheValid() && this.foodCache.size > 0) {
                console.log(`SupabaseFoodDatabase: ローカルキャッシュでファジー検索実行 (キャッシュサイズ: ${this.foodCache.size}, エイリアス数: ${this.foodAliasesMap.size})`);
                return this.localFuzzySearch(query, limit);
            }

            console.log(`SupabaseFoodDatabase: Supabaseファジー検索関数を呼び出し`);

            // Supabaseファジー検索関数を呼び出し
            const { data, error } = await this.supabase
                .rpc('fuzzy_search_food_with_aliases', {
                    search_term: query,
                    similarity_threshold: 0.2, // 0.3から0.2に下げて検索結果を増やす
                    result_limit: limit
                });

            if (error) {
                console.error('SupabaseFoodDatabase: ファジー検索エラー:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.log('SupabaseFoodDatabase: ファジー検索 - 結果なし');

                // Supabaseで結果が見つからない場合のみキャッシュを確認
                if (this.isCacheValid() && this.foodCache.size > 0) {
                    console.log('SupabaseFoodDatabase: Supabaseで結果が見つからないため、キャッシュで検索');
                    return this.localFuzzySearch(query, limit);
                }

                return [];
            }

            // 結果をDatabaseFoodItem形式に変換
            const results = data.map((item: any) => {
                const foodItem: DatabaseFoodItem = {
                    name: item.name,
                    calories: item.calories || 0,
                    protein: item.protein || 0,
                    iron: item.iron || 0,
                    folic_acid: item.folic_acid || 0,
                    calcium: item.calcium || 0,
                    vitamin_d: item.vitamin_d || 0,
                    standard_quantity: item.standard_quantity || '100g',
                    cooking_method: item.cooking_method,
                    category_id: item.category_id
                };

                // 検索結果をキャッシュに追加
                const normalizedName = this.normalizeKey(item.name);
                if (!this.foodCache.has(normalizedName)) {
                    this.foodCache.set(normalizedName, foodItem);
                    console.log(`SupabaseFoodDatabase: "${item.name}" をキャッシュに追加`);
                }

                return {
                    food: foodItem,
                    similarity: item.similarity || 0
                };
            });

            console.log(`SupabaseFoodDatabase: ファジー検索 - ${results.length}件の結果`);

            // キャッシュ更新日時を設定（部分更新）
            if (results.length > 0 && !this.cacheLastRefreshed) {
                this.cacheLastRefreshed = new Date();
            }

            return results;

        } catch (error) {
            console.error('SupabaseFoodDatabase: ファジー検索エラー:', error);

            // エラー発生時、キャッシュがあればフォールバックとして使用
            if (this.isCacheValid() && this.foodCache.size > 0) {
                console.log('SupabaseFoodDatabase: エラー発生のため、キャッシュで検索');
                const savedQuery = name.trim(); // queryを保存して使用
                return this.localFuzzySearch(savedQuery, limit);
            }

            // エラー時は空の結果を返す
            return [];
        }
    }

    /**
     * ローカルでのシンプルなファジー検索（キャッシュデータを使用）
     * @private
     */
    private async localFuzzySearch(query: string, limit: number): Promise<Array<{ food: DatabaseFoodItem, similarity: number }>> {
        await this.ensureCacheLoaded();

        const normalizedQuery = this.normalizeKey(query);
        console.log(`SupabaseFoodDatabase: ローカルファジー検索 - 正規化: 「${query}」→「${normalizedQuery}」`);

        const results: Array<{ food: DatabaseFoodItem, score: number }> = [];

        // 完全一致（最優先）
        for (const [key, food] of this.foodCache.entries()) {
            if (key === normalizedQuery) {
                console.log(`SupabaseFoodDatabase: 完全一致「${food.name}」(score: 1.0)`);
                results.push({ food, score: 1.0 });
                continue;
            }

            // 部分一致スコア計算（より詳細なログ）
            if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
                const score = key.includes(normalizedQuery)
                    ? normalizedQuery.length / key.length
                    : key.length / normalizedQuery.length;

                if (score > 0.5) { // スコアが十分高い場合のみログ出力
                    console.log(`SupabaseFoodDatabase: 部分一致「${food.name}」(score: ${score.toFixed(2)})`);
                }
                results.push({ food, score });
            }
        }

        // エイリアス検索の強化 - 最初にエイリアスを優先的に検索
        console.log(`SupabaseFoodDatabase: エイリアス検索 - エイリアス数: ${this.foodAliasesMap.size}件`);

        // 直接エイリアス検索（完全一致 - 最優先）
        for (const [foodName, aliases] of this.foodAliasesMap.entries()) {
            for (const alias of aliases) {
                const normalizedAlias = this.normalizeKey(alias);

                // 元のキーと完全一致
                if (normalizedQuery === normalizedAlias) {
                    const food = this.foodCache.get(foodName);
                    if (food) {
                        console.log(`SupabaseFoodDatabase: エイリアス完全一致「${food.name}」(エイリアス:「${alias}」, score: 1.0)`);
                        // エイリアス完全一致は食品名完全一致と同等の高いスコアを与える
                        results.push({ food, score: 1.0 });
                        break;
                    }
                }
            }
        }

        // 元のエイリアス部分一致検索ロジック
        for (const [foodName, aliases] of this.foodAliasesMap.entries()) {
            // 既に高スコアで結果に含まれている食品はスキップ
            if (results.some(r => this.normalizeKey(r.food.name) === foodName && r.score > 0.7)) continue;

            for (const alias of aliases) {
                const normalizedAlias = this.normalizeKey(alias);

                // 部分一致検索 - よりきめ細かいマッチング
                if (normalizedAlias.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlias)) {
                    const score = normalizedAlias.includes(normalizedQuery)
                        ? (normalizedQuery.length / normalizedAlias.length) * 0.9 // スコア向上
                        : (normalizedAlias.length / normalizedQuery.length) * 0.8;
                    const food = this.foodCache.get(foodName);
                    if (food && score > 0.4) { // スコアの閾値を下げて検索範囲を広げる
                        console.log(`SupabaseFoodDatabase: エイリアス部分一致「${food.name}」(エイリアス:「${alias}」, score: ${score.toFixed(2)})`);
                        results.push({ food, score });
                    }
                }
            }
        }

        // スコアでソートして上位を返す
        results.sort((a, b) => b.score - a.score);

        const topResults = results.slice(0, limit);
        console.log(`SupabaseFoodDatabase: ローカルファジー検索結果 - ${topResults.length}件`);
        topResults.forEach((item, index) => {
            console.log(`  ${index + 1}. 「${item.food.name}」(類似度: ${item.score.toFixed(2)})`);
        });

        return topResults.map(item => ({
            food: item.food,
            similarity: item.score
        }));
    }

    /**
     * 食品リストから栄養計算
     */
    public async calculateNutrition(foods: FoodItem[]): Promise<NutritionData> {
        if (!foods || foods.length === 0) {
            return {
                calories: 0,
                protein: 0,
                iron: 0,
                folic_acid: 0,
                calcium: 0,
                vitamin_d: 0,
                confidence_score: 0,
                notFoundFoods: []
            };
        }

        console.log(`SupabaseFoodDatabase: 栄養計算開始 - ${foods.length}品目`);
        await this.ensureCacheLoaded();

        // 計算結果の初期化
        let totalCalories = 0;
        let totalProtein = 0;
        let totalIron = 0;
        let totalFolicAcid = 0;
        let totalCalcium = 0;
        let totalVitaminD = 0;
        let totalConfidence = 0;
        let foundCount = 0;
        const notFoundFoods: string[] = [];
        const foundMatches: Record<string, { original: string, matched: string, similarity: number }> = {};

        // 各食品の栄養素を計算
        for (const food of foods) {
            const foodName = food.name.trim();
            if (!foodName) continue;

            console.log(`SupabaseFoodDatabase: 食品「${foodName}」の栄養計算開始`);

            // まず完全一致で検索 (エイリアス含む)
            const exactFood = await this.getFoodByExactName(foodName);
            if (exactFood) {
                // 量の解析
                const quantity = this.parseQuantity(food.quantity, exactFood.standard_quantity);
                const ratio = quantity.ratio;

                // 完全一致は最高の信頼度
                const confidence = food.confidence || 0.95;

                // 栄養素の積算
                totalCalories += exactFood.calories * ratio;
                totalProtein += exactFood.protein * ratio;
                totalIron += exactFood.iron * ratio;
                totalFolicAcid += exactFood.folic_acid * ratio;
                totalCalcium += exactFood.calcium * ratio;
                if (exactFood.vitamin_d) totalVitaminD += exactFood.vitamin_d * ratio;

                totalConfidence += confidence;
                foundCount++;

                foundMatches[foodName] = {
                    original: foodName,
                    matched: exactFood.name,
                    similarity: 1.0
                };

                console.log(`SupabaseFoodDatabase: 食品「${foodName}」⇒「${exactFood.name}」完全一致, カロリー: ${(exactFood.calories * ratio).toFixed(1)}kcal, 比率: ${ratio.toFixed(2)}`);
                continue;
            }

            // 完全一致で見つからない場合はファジー検索
            const fuzzyResults = await this.getFoodsByFuzzyMatch(foodName, 1);
            if (fuzzyResults.length > 0 && fuzzyResults[0].similarity >= 0.25) { // 閾値を0.3から0.25に下げる
                const bestMatch = fuzzyResults[0];
                const dbFood = bestMatch.food;
                const similarity = bestMatch.similarity;

                // 量の解析
                const quantity = this.parseQuantity(food.quantity, dbFood.standard_quantity);
                const ratio = quantity.ratio;

                // 信頼度は食品の信頼度と類似度の組み合わせ
                const confidence = (food.confidence || 0.7) * similarity;

                // 栄養素の積算
                totalCalories += dbFood.calories * ratio;
                totalProtein += dbFood.protein * ratio;
                totalIron += dbFood.iron * ratio;
                totalFolicAcid += dbFood.folic_acid * ratio;
                totalCalcium += dbFood.calcium * ratio;
                if (dbFood.vitamin_d) totalVitaminD += dbFood.vitamin_d * ratio;

                totalConfidence += confidence;
                foundCount++;

                foundMatches[foodName] = {
                    original: foodName,
                    matched: dbFood.name,
                    similarity: similarity
                };

                console.log(`SupabaseFoodDatabase: 食品「${foodName}」⇒「${dbFood.name}」一致 (${similarity.toFixed(2)}), カロリー: ${(dbFood.calories * ratio).toFixed(1)}kcal, 比率: ${ratio.toFixed(2)}`);
            } else {
                console.log(`SupabaseFoodDatabase: 食品「${foodName}」は見つかりませんでした`);
                notFoundFoods.push(foodName);
            }
        }

        // 平均信頼度の計算
        const averageConfidence = foundCount > 0 ? totalConfidence / foundCount : 0;

        // 見つからなかった食品が多い場合は信頼度を下げる
        const notFoundRatio = foods.length > 0 ? notFoundFoods.length / foods.length : 0;
        const adjustedConfidence = averageConfidence * (1 - notFoundRatio * 0.5);

        console.log(`SupabaseFoodDatabase: 栄養計算完了 - 合計カロリー: ${totalCalories.toFixed(1)}kcal, 信頼度: ${adjustedConfidence.toFixed(2)}`);

        // マッチング結果をログ出力
        console.log(`SupabaseFoodDatabase: マッチング結果:`, Object.values(foundMatches));

        return {
            calories: Math.max(0, Math.round(totalCalories)),
            protein: Math.max(0, parseFloat(totalProtein.toFixed(1))),
            iron: Math.max(0, parseFloat(totalIron.toFixed(1))),
            folic_acid: Math.max(0, Math.round(totalFolicAcid)),
            calcium: Math.max(0, Math.round(totalCalcium)),
            vitamin_d: Math.max(0, parseFloat(totalVitaminD.toFixed(1))),
            confidence_score: parseFloat(adjustedConfidence.toFixed(2)),
            notFoundFoods,
            matchedFoods: Object.values(foundMatches)
        };
    }

    /**
     * 量の文字列をパースし、基準量に対する比率を計算
     * @private
     */
    private parseQuantity(quantityStr: string | undefined, standardQuantity: string | undefined): { ratio: number, unit: string } {
        if (!quantityStr) return { ratio: 1, unit: '個' };
        if (!standardQuantity) standardQuantity = '100g'; // デフォルト値を設定

        const normalized = quantityStr.trim().toLowerCase();

        // 完全な単位指定がない場合、標準量を基準に計算
        if (/^[\d.]+$/.test(normalized)) {
            return { ratio: parseFloat(normalized), unit: '倍' };
        }

        // グラム指定の場合
        const gramMatch = normalized.match(/^([\d.]+)(\s*)(g|グラム|ｇ)/i);
        if (gramMatch) {
            const value = parseFloat(gramMatch[1]);
            // 標準量からグラム数を抽出
            const stdGramMatch = standardQuantity.match(/^([\d.]+)(\s*)(g|グラム|ｇ)/i);
            if (stdGramMatch) {
                const stdValue = parseFloat(stdGramMatch[1]);
                return { ratio: value / stdValue, unit: 'g' };
            }
            return { ratio: value / 100, unit: 'g' }; // デフォルトは100gを基準
        }

        // カップ指定の場合
        const cupMatch = normalized.match(/^([\d.／/]+)(\s*)(カップ|cup)/i);
        if (cupMatch) {
            let value = parseFraction(cupMatch[1]);
            return { ratio: value, unit: 'カップ' };
        }

        // 大さじ/小さじの場合
        const tbspMatch = normalized.match(/^([\d.／/]+)(\s*)(大さじ|tbsp|おおさじ)/i);
        if (tbspMatch) {
            let value = parseFraction(tbspMatch[1]);
            return { ratio: value * 0.15, unit: '大さじ' }; // 大さじ1は約15g
        }

        const tspMatch = normalized.match(/^([\d.／/]+)(\s*)(小さじ|tsp|こさじ)/i);
        if (tspMatch) {
            let value = parseFraction(tspMatch[1]);
            return { ratio: value * 0.05, unit: '小さじ' }; // 小さじ1は約5g
        }

        // 個数指定の場合
        const countMatch = normalized.match(/^([\d.／/]+)(\s*)(個|こ|本|ほん|枚|まい)/i);
        if (countMatch) {
            let value = parseFraction(countMatch[1]);
            return { ratio: value, unit: '個' };
        }

        // 人前指定の場合
        const servingMatch = normalized.match(/^([\d.／/]+)(\s*)(人前|にんまえ|服用|ふくよう)/i);
        if (servingMatch) {
            let value = parseFraction(servingMatch[1]);
            return { ratio: value, unit: '人前' };
        }

        // デフォルト値（解析できない場合）
        return { ratio: 1, unit: '単位' };
    }

    /**
     * キャッシュが読み込まれていることを確認
     * @private
     */
    private async ensureCacheLoaded(): Promise<void> {
        if (!this.isCacheValid() || this.foodCache.size === 0) {
            await this.refreshCache();
        }
    }

    // キャッシュを強制的に更新する公開メソッド
    public forceRefreshCache(): Promise<void> {
        this.forceNextRefresh = true;
        return this.refreshCache();
    }
}

/**
 * 分数表記を解析する補助関数
 * @private
 */
function parseFraction(str: string): number {
    // 3/4や１／２のような分数表記を処理
    const fractionMatch = str.match(/^([\d.]+)[\/／]([\d.]+)$/);
    if (fractionMatch) {
        return parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
    }
    return parseFloat(str);
} 