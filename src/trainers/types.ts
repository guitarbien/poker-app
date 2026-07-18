export interface QuizQuestion<TPayload> {
  id: string; // payload 的決定性編碼（錯題本比對用）
  payload: TPayload; // 可序列化，UI 渲染與重出題都靠它
}
