import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * クラス名を結合するユーティリティ関数
 * clsxでクラス名を結合し、tailwind-mergeで競合するクラスを解決します
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
