export interface SoapNote {
  subjective: string
  objective: string
  assessment: string
  plan: string
  source?: 'manual' | 'ai_draft_reviewed' | null
  draft_id?: string | null
  provider?: string | null
  model?: string | null
  generated_at?: string | null
  authored_by?: string | null
  authored_at?: string | null
}

export interface SoapDraftResponse {
  draft_id: string
  soap: Pick<SoapNote, 'subjective' | 'objective' | 'assessment' | 'plan'>
  warnings: string[]
  source_fidelity: {
    invented_facts_detected: boolean
    missing_key_inputs: string[]
    used_sections: string[]
  }
  meta: {
    provider: string
    model: string
    generated_at: string
    usage?: {
      input_tokens: number
      cache_creation_input_tokens: number
      cache_read_input_tokens: number
      output_tokens: number
    }
  }
}

export interface SoapDraftApiResponse {
  data: SoapDraftResponse
}
