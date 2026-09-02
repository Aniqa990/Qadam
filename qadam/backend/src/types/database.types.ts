export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          event_id: string
          hours: number | null
          id: string
          project_id: string
          registration_id: string
          volunteer_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          event_id: string
          hours?: number | null
          id?: string
          project_id: string
          registration_id: string
          volunteer_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          event_id?: string
          hours?: number | null
          id?: string
          project_id?: string
          registration_id?: string
          volunteer_id?: string
        }
        Relationships: [
          { foreignKeyName: "attendance_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "attendance_registration_id_fkey"; columns: ["registration_id"]; isOneToOne: false; referencedRelation: "registrations"; referencedColumns: ["id"] },
          { foreignKeyName: "attendance_volunteer_id_fkey"; columns: ["volunteer_id"]; isOneToOne: false; referencedRelation: "volunteers"; referencedColumns: ["id"] },
        ]
      }
      attendance_tokens: {
        Row: { created_at: string; created_by: string; event_date: string; event_id: string; event_name: string | null; id: string; project_id: string; token: string; window_end: string; window_start: string }
        Insert: { created_at?: string; created_by: string; event_date: string; event_id: string; event_name?: string | null; id?: string; project_id: string; token: string; window_end: string; window_start: string }
        Update: { created_at?: string; created_by?: string; event_date?: string; event_id?: string; event_name?: string | null; id?: string; project_id?: string; token?: string; window_end?: string; window_start?: string }
        Relationships: [
          { foreignKeyName: "attendance_tokens_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
        ]
      }
      knowledge_chunks: {
        Row: { chunk_index: number; content: string; created_at: string; document_id: string; embedding: string | null; id: string; ngo_id: string }
        Insert: { chunk_index: number; content: string; created_at?: string; document_id: string; embedding?: string | null; id?: string; ngo_id: string }
        Update: { chunk_index?: number; content?: string; created_at?: string; document_id?: string; embedding?: string | null; id?: string; ngo_id?: string }
        Relationships: [
          { foreignKeyName: "knowledge_chunks_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "knowledge_documents"; referencedColumns: ["id"] },
          { foreignKeyName: "knowledge_chunks_ngo_id_fkey"; columns: ["ngo_id"]; isOneToOne: false; referencedRelation: "ngos"; referencedColumns: ["id"] },
        ]
      }
      knowledge_documents: {
        Row: { chunk_count: number | null; created_at: string; error_message: string | null; file_name: string; file_size: number; file_type: string; id: string; ngo_id: string; status: Database["public"]["Enums"]["document_status"]; storage_path: string }
        Insert: { chunk_count?: number | null; created_at?: string; error_message?: string | null; file_name: string; file_size: number; file_type: string; id?: string; ngo_id: string; status?: Database["public"]["Enums"]["document_status"]; storage_path: string }
        Update: { chunk_count?: number | null; created_at?: string; error_message?: string | null; file_name?: string; file_size?: number; file_type?: string; id?: string; ngo_id?: string; status?: Database["public"]["Enums"]["document_status"]; storage_path?: string }
        Relationships: [
          { foreignKeyName: "knowledge_documents_ngo_id_fkey"; columns: ["ngo_id"]; isOneToOne: false; referencedRelation: "ngos"; referencedColumns: ["id"] },
        ]
      }
      ngos: {
        Row: { auth_user_id: string; categories: string[]; created_at: string; description: string | null; email: string; id: string; logo_url: string | null; mission: string | null; name: string; onboarding_complete: boolean; phone: string | null; registration_number: string | null; updated_at: string; website: string | null }
        Insert: { auth_user_id: string; categories?: string[]; created_at?: string; description?: string | null; email: string; id?: string; logo_url?: string | null; mission?: string | null; name: string; onboarding_complete?: boolean; phone?: string | null; registration_number?: string | null; updated_at?: string; website?: string | null }
        Update: { auth_user_id?: string; categories?: string[]; created_at?: string; description?: string | null; email?: string; id?: string; logo_url?: string | null; mission?: string | null; name?: string; onboarding_complete?: boolean; phone?: string | null; registration_number?: string | null; updated_at?: string; website?: string | null }
        Relationships: []
      }
      project_embeddings: {
        Row: { content_hash: string; embedding: string; id: string; project_id: string; updated_at: string }
        Insert: { content_hash: string; embedding: string; id?: string; project_id: string; updated_at?: string }
        Update: { content_hash?: string; embedding?: string; id?: string; project_id?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "project_embeddings_project_id_fkey"; columns: ["project_id"]; isOneToOne: true; referencedRelation: "projects"; referencedColumns: ["id"] },
        ]
      }
      projects: {
        Row: { capacity: number; category: string; created_at: string; description: string; eligibility: Json; end_date: string; event_date: string | null; hours_per_session: number | null; id: string; location_lat: number | null; location_lng: number | null; location_name: string | null; ngo_id: string; required_skills: string[]; responsibilities: string[]; start_date: string; status: Database["public"]["Enums"]["project_status"]; title: string; updated_at: string; whatsapp_group_url: string | null }
        Insert: { capacity: number; category: string; created_at?: string; description: string; eligibility?: Json; end_date: string; event_date?: string | null; hours_per_session?: number | null; id?: string; location_lat?: number | null; location_lng?: number | null; location_name?: string | null; ngo_id: string; required_skills?: string[]; responsibilities?: string[]; start_date: string; status?: Database["public"]["Enums"]["project_status"]; title: string; updated_at?: string; whatsapp_group_url?: string | null }
        Update: { capacity?: number; category?: string; created_at?: string; description?: string; eligibility?: Json; end_date?: string; event_date?: string | null; hours_per_session?: number | null; id?: string; location_lat?: number | null; location_lng?: number | null; location_name?: string | null; ngo_id?: string; required_skills?: string[]; responsibilities?: string[]; start_date?: string; status?: Database["public"]["Enums"]["project_status"]; title?: string; updated_at?: string; whatsapp_group_url?: string | null }
        Relationships: [
          { foreignKeyName: "projects_ngo_id_fkey"; columns: ["ngo_id"]; isOneToOne: false; referencedRelation: "ngos"; referencedColumns: ["id"] },
        ]
      }
      registrations: {
        Row: { cancelled_at: string | null; id: string; project_id: string; registered_at: string; status: Database["public"]["Enums"]["registration_status"]; volunteer_id: string }
        Insert: { cancelled_at?: string | null; id?: string; project_id: string; registered_at?: string; status?: Database["public"]["Enums"]["registration_status"]; volunteer_id: string }
        Update: { cancelled_at?: string | null; id?: string; project_id?: string; registered_at?: string; status?: Database["public"]["Enums"]["registration_status"]; volunteer_id?: string }
        Relationships: [
          { foreignKeyName: "registrations_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "registrations_volunteer_id_fkey"; columns: ["volunteer_id"]; isOneToOne: false; referencedRelation: "volunteers"; referencedColumns: ["id"] },
        ]
      }
      volunteer_embeddings: {
        Row: { content_hash: string; embedding: string; id: string; updated_at: string; volunteer_id: string }
        Insert: { content_hash: string; embedding: string; id?: string; updated_at?: string; volunteer_id: string }
        Update: { content_hash?: string; embedding?: string; id?: string; updated_at?: string; volunteer_id?: string }
        Relationships: [
          { foreignKeyName: "volunteer_embeddings_volunteer_id_fkey"; columns: ["volunteer_id"]; isOneToOne: true; referencedRelation: "volunteers"; referencedColumns: ["id"] },
        ]
      }
      volunteers: {
        Row: { age: number | null; auth_user_id: string; created_at: string; email: string; experience: string | null; full_name: string; id: string; interests: string[]; location_lat: number | null; location_lng: number | null; location_name: string | null; onboarding_complete: boolean; phone: string | null; skills: string[]; updated_at: string }
        Insert: { age?: number | null; auth_user_id: string; created_at?: string; email: string; experience?: string | null; full_name: string; id?: string; interests?: string[]; location_lat?: number | null; location_lng?: number | null; location_name?: string | null; onboarding_complete?: boolean; phone?: string | null; skills?: string[]; updated_at?: string }
        Update: { age?: number | null; auth_user_id?: string; created_at?: string; email?: string; experience?: string | null; full_name?: string; id?: string; interests?: string[]; location_lat?: number | null; location_lng?: number | null; location_name?: string | null; onboarding_complete?: boolean; phone?: string | null; skills?: string[]; updated_at?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      match_knowledge_chunks: {
        Args: { match_count: number; match_threshold: number; ngo_uuid: string; query_embedding: string }
        Returns: { chunk_id: string; content: string; document_id: string; similarity: number }[]
      }
      match_projects: {
        Args: { match_count: number; match_threshold: number; query_embedding: string }
        Returns: { project_id: string; similarity: number }[]
      }
      match_volunteers: {
        Args: { match_count: number; match_threshold: number; query_embedding: string }
        Returns: { similarity: number; volunteer_id: string }[]
      }
    }
    Enums: {
      document_status: "uploaded" | "processing" | "ready" | "failed"
      project_status: "draft" | "published" | "active" | "completed" | "cancelled"
      registration_status: "confirmed" | "cancelled"
      user_role: "volunteer" | "ngo"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  N extends (T extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[T["schema"]]["Tables"] & DatabaseWithoutInternals[T["schema"]]["Views"])
    : never) = never,
> = T extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[T["schema"]]["Tables"] & DatabaseWithoutInternals[T["schema"]]["Views"])[N] extends { Row: infer R } ? R : never
  : T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never
    : never

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  N extends (T extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[T["schema"]]["Tables"]
    : never) = never,
> = T extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[T["schema"]]["Tables"][N] extends { Insert: infer I } ? I : never
  : T extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never
    : never

export type TablesUpdate<
  T extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  N extends (T extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[T["schema"]]["Tables"]
    : never) = never,
> = T extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[T["schema"]]["Tables"][N] extends { Update: infer U } ? U : never
  : T extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never
    : never

export type Enums<
  T extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  N extends (T extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[T["schema"]]["Enums"]
    : never) = never,
> = T extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[T["schema"]]["Enums"][N]
  : T extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][T]
    : never

export const Constants = {
  public: {
    Enums: {
      document_status: ["uploaded", "processing", "ready", "failed"],
      project_status: ["draft", "published", "active", "completed", "cancelled"],
      registration_status: ["confirmed", "cancelled"],
      user_role: ["volunteer", "ngo"],
    },
  },
} as const
