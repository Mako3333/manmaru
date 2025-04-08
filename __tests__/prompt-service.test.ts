import { PromptService, PromptType } from '@/lib/ai/prompts/prompt-service';

describe('PromptService', () => {
    let promptService: PromptService;

    beforeAll(() => {
        promptService = PromptService.getInstance();
    });

    test('generateFoodAnalysisPrompt generates valid prompt', () => {
        const context = {
            mealType: '朝食',
            trimester: 2
        };

        const prompt = promptService.generateFoodAnalysisPrompt(context);

        expect(prompt).toContain('朝食');
        expect(prompt).toContain('妊娠第2期');
        expect(prompt).toContain('JSON形式で回答');
    });

    test('generateNutritionAdvicePrompt generates summary prompt', () => {
        const context = {
            pregnancyWeek: 20,
            trimester: 2,
            deficientNutrients: ['鉄分', '葉酸'],
            isSummary: true,
            formattedDate: '2023年4月1日',
            currentSeason: '春'
        };

        const prompt = promptService.generateNutritionAdvicePrompt(context);

        expect(prompt).toContain('20週目');
        expect(prompt).toContain('鉄分,葉酸');
        expect(prompt).toContain('簡潔なアドバイス');
        expect(prompt).not.toContain('詳細なアドバイス');
    });

    test('generateNutritionAdvicePrompt generates detailed prompt', () => {
        const context = {
            pregnancyWeek: 30,
            trimester: 3,
            deficientNutrients: [],
            isSummary: false,
            formattedDate: '2023年8月1日',
            currentSeason: '夏'
        };

        const prompt = promptService.generateNutritionAdvicePrompt(context);

        expect(prompt).toContain('30週目');
        expect(prompt).toContain('詳細なアドバイス');
        expect(prompt).toContain('"recommended_foods"');
        expect(prompt).toContain('夏の旬の食材');
    });

    test('generateTextInputAnalysisPrompt generates valid prompt', () => {
        const context = {
            foodsText: '・ご飯 1杯\n・味噌汁\n・焼き鮭 1切れ'
        };

        const prompt = promptService.generateTextInputAnalysisPrompt(context);

        expect(prompt).toContain('・ご飯 1杯');
        expect(prompt).toContain('・味噌汁');
        expect(prompt).toContain('・焼き鮭 1切れ');
    });
}); 