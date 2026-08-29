import { analyzeHarp } from '../utils/geometry.js'

export function useModelAnalysis(root) {
  if (!root) return null
  return analyzeHarp(root)
}
