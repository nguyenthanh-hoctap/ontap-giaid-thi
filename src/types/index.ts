export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const SUBJECTS: Record<string, string[]> = {
  '1-5': ['Toán', 'Tiếng Việt', 'Tiếng Anh', 'Tự nhiên và Xã hội', 'Đạo đức'],
  '6-9': ['Toán', 'Ngữ Văn', 'Tiếng Anh', 'Vật Lý', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lý', 'GDCD'],
}

export function getSubjectsForGrade(grade: Grade): string[] {
  return grade <= 5 ? SUBJECTS['1-5'] : SUBJECTS['6-9']
}

export interface Syllabus {
  id: string
  user_id: string
  title: string
  subject: string
  grade: Grade
  image_urls: string[]
  extracted_content: string | null
  status: 'pending' | 'processing' | 'done' | 'error'
  created_at: string
}

export interface ExamSet {
  id: string
  syllabus_id: string
  title: string
  subject: string
  grade: Grade
  total_questions: number
  created_at: string
}

export interface Question {
  id: string
  exam_set_id: string
  order_number: number
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'proof'
  question_text: string
  options: { key: string; text: string }[] | null
  correct_answer: string
  explanation: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  diagram: string | null
}

export interface PracticeSession {
  id: string
  user_id: string
  exam_set_id: string
  answers: Record<string, string>
  score: number | null
  total: number | null
  completed_at: string | null
}
