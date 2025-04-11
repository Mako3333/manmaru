### 課題3: RecipeService 栄養データ変換修正
#### チケット名: refactor/fix-nutrition-conversion-in-recipeservice
#### タイトル: リファクタリング: RecipeService.getRecipeById の栄養データ変換修正
##### 説明
`src/lib/services/recipe-service.ts` の `getRecipeById` 関数内で、DB(`clipped_recipes.nutrition_per_serving`)から取得したJSONB形式の栄養データを `StandardizedMealNutrition` 型に変換する必要があります。

現状では `convertToStandardizedNutrition` 関数が使用されていますが、これは旧 `NutritionData` 型からの変換を想定しています。
タスク6で実装された新しいDB保存用JSON構造 (`DbNutritionData`) からの変換には、`convertDbFormatToStandardizedNutrition` 関数を使用するように修正する必要があります。

修正にあたっては、DBから取得するデータの型安全性を考慮し、適切な型ガードやバリデーションを行う必要があります。
##### 優先度: 中
##### 完了条件
`RecipeService.getRecipeById` が、DBから取得した `nutrition_per_serving` を `convertDbFormatToStandardizedNutrition` を用いて正しく `StandardizedMealNutrition` に変換し、型安全性が確保されていること。 