import { AnalyzeMealResponse } from '../types';

export interface BarcodeProductResult {
  found: boolean;
  productName: string;
  brand?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  servingSize?: string;
  ingredients: string[];
  imageUrl?: string;
}

/**
 * Queries OpenFoodFacts API for official nutritional data by barcode (EAN-13, UPC-A, etc.)
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeProductResult | null> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return null;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AICalorieTracker/1.0 (Mobile App)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    // Determine calories (serving or 100g)
    const calories = Math.round(
      nutriments['energy-kcal_serving'] ??
      nutriments['energy-kcal_100g'] ??
      nutriments['energy-kcal'] ??
      0
    );

    // Determine protein
    const protein_g = Math.round(
      nutriments['proteins_serving'] ??
      nutriments['proteins_100g'] ??
      nutriments['proteins'] ??
      0
    );

    // Determine carbs
    const carbs_g = Math.round(
      nutriments['carbohydrates_serving'] ??
      nutriments['carbohydrates_100g'] ??
      nutriments['carbohydrates'] ??
      0
    );

    // Determine fat
    const fat_g = Math.round(
      nutriments['fat_serving'] ??
      nutriments['fat_100g'] ??
      nutriments['fat'] ??
      0
    );

    const productName = product.product_name || product.product_name_en || 'Packaged Food';
    const brand = product.brands ? product.brands.split(',')[0].trim() : undefined;
    const servingSize = product.serving_size || '1 serving';

    const ingredients: string[] = [];
    if (product.ingredients_text) {
      const splitIngredients = product.ingredients_text
        .split(/[,;]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && s.length < 50)
        .slice(0, 6);
      ingredients.push(...splitIngredients);
    }

    if (ingredients.length === 0) {
      ingredients.push(servingSize);
    }

    return {
      found: true,
      productName: brand ? `${brand} ${productName}` : productName,
      brand,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      servingSize,
      ingredients,
      imageUrl: product.image_url || product.image_front_url,
    };
  } catch (err) {
    console.error('Error looking up barcode from OpenFoodFacts:', err);
    return null;
  }
}
