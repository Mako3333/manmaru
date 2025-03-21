-- ファジー検索のための関数作成
CREATE OR REPLACE FUNCTION fuzzy_search_food(
    search_term TEXT,
    similarity_threshold FLOAT DEFAULT 0.3,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    calories FLOAT,
    protein FLOAT,
    iron FLOAT,
    folic_acid FLOAT,
    calcium FLOAT,
    vitamin_d FLOAT,
    standard_quantity TEXT,
    cooking_method TEXT,
    category_id TEXT,
    similarity FLOAT
) 
LANGUAGE SQL
AS $$
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        similarity(f.name, search_term) AS similarity
    FROM
        food_items f
    WHERE
        similarity(f.name, search_term) > similarity_threshold
    ORDER BY
        similarity DESC
    LIMIT result_limit;
$$;

-- 前方一致検索のための関数作成
CREATE OR REPLACE FUNCTION fuzzy_search_food_by_prefix(
    search_term TEXT,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    calories FLOAT,
    protein FLOAT,
    iron FLOAT,
    folic_acid FLOAT,
    calcium FLOAT,
    vitamin_d FLOAT,
    standard_quantity TEXT,
    cooking_method TEXT,
    category_id TEXT,
    similarity FLOAT
) 
LANGUAGE SQL
AS $$
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        1.0 AS similarity
    FROM
        food_items f
    WHERE
        f.name ILIKE (search_term || '%')
    ORDER BY
        f.name
    LIMIT result_limit;
$$;

-- エイリアスを含めたファジー検索関数
CREATE OR REPLACE FUNCTION fuzzy_search_food_with_aliases(
    search_term TEXT,
    similarity_threshold FLOAT DEFAULT 0.3,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    calories FLOAT,
    protein FLOAT,
    iron FLOAT,
    folic_acid FLOAT,
    calcium FLOAT,
    vitamin_d FLOAT,
    standard_quantity TEXT,
    cooking_method TEXT,
    category_id TEXT,
    similarity FLOAT,
    match_type TEXT
) 
LANGUAGE SQL
AS $$
    -- エイリアス完全一致検索（最優先）
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        1.0 AS similarity,
        '1_alias_exact' AS match_type  -- 並び順を確保するために数字プレフィックス
    FROM
        food_aliases a
    JOIN
        food_items f ON a.food_id = f.id
    WHERE
        LOWER(a.alias) = LOWER(search_term)
    
    UNION ALL
    
    -- 通常の完全一致検索（2番目の優先度）
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        0.99 AS similarity,  -- エイリアス完全一致より少し低いスコア
        '2_direct_exact' AS match_type
    FROM
        food_items f
    WHERE
        LOWER(f.name) = LOWER(search_term)
    
    UNION ALL
    
    -- エイリアス部分一致検索（3番目の優先度）
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        0.9 AS similarity,
        '3_alias_partial' AS match_type
    FROM
        food_aliases a
    JOIN
        food_items f ON a.food_id = f.id
    WHERE
        LOWER(a.alias) LIKE (LOWER(search_term) || '%')
        AND LOWER(a.alias) <> LOWER(search_term)
    
    UNION ALL
    
    -- エイリアスのファジー検索（4番目の優先度）
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        similarity(a.alias, search_term) AS similarity,
        '4_alias_fuzzy' AS match_type
    FROM
        food_aliases a
    JOIN
        food_items f ON a.food_id = f.id
    WHERE
        similarity(a.alias, search_term) > similarity_threshold
        AND LOWER(a.alias) <> LOWER(search_term)  -- 完全一致はすでに上で処理
    
    UNION ALL
    
    -- 食品名のファジー検索（最後の優先度）
    SELECT
        f.id,
        f.name,
        f.calories,
        f.protein,
        f.iron,
        f.folic_acid,
        f.calcium,
        f.vitamin_d,
        f.standard_quantity,
        f.cooking_method,
        f.category_id,
        similarity(f.name, search_term) AS similarity,
        '5_direct_fuzzy' AS match_type
    FROM
        food_items f
    WHERE
        similarity(f.name, search_term) > similarity_threshold
        AND LOWER(f.name) <> LOWER(search_term)  -- 完全一致はすでに上で処理
    
    ORDER BY
        match_type,  -- match_typeの数字プレフィックスにより順序付け
        similarity DESC
    LIMIT result_limit;
$$; 