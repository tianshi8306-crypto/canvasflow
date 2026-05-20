export type SubjectCategory = "character" | "product" | "pet" | "person";

export type Subject = {
  id: string;
  name: string;
  description: string;
  category: SubjectCategory;
  imagePaths: string[];
  voicePath?: string;
  voiceText?: string;
  createdAt: number;
};

export type SubjectDraft = {
  name: string;
  description: string;
  category: SubjectCategory;
  imagePaths: string[];
  voicePath?: string;
  voiceText?: string;
};
