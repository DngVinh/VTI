import {
  Difficulty,
  LocalizedText,
  QuestionType,
  RubricCriterion,
} from '../../domain/question-bank/types';

export interface PublicTaxonomyItem {
  id: string;
  name: string;
  code?: string;
}

export interface PublicTechnologyItem extends PublicTaxonomyItem {
  relevance?: number | null;
}

export interface PublicQuestionSummaryDto {
  id: string;
  code: string;
  prompt: LocalizedText;
  difficulty: Difficulty | null;
  questionType: QuestionType | null;
  primaryRoleId: string | null;
  role: PublicTaxonomyItem | null;
  levelIds: string[];
  levels: PublicTaxonomyItem[];
  technologies: PublicTechnologyItem[];
  topic: string | null;
  tags: string[];
  updatedAt: string;
}

export interface PaginatedPublicQuestionsDto {
  items: PublicQuestionSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PublicQuestionDetailDto {
  id: string;
  code: string;
  versionNumber: number;
  prompt: LocalizedText;
  explanation: LocalizedText;
  referenceAnswer: LocalizedText;
  learningObjective: LocalizedText;
  rubric: RubricCriterion[];
  difficulty: Difficulty | null;
  questionType: QuestionType | null;
  primaryRoleId: string | null;
  role: PublicTaxonomyItem | null;
  levelIds: string[];
  levels: PublicTaxonomyItem[];
  technologies: PublicTechnologyItem[];
  topic: string | null;
  tags: string[];
  estimatedTimeSeconds: number | null;
  updatedAt: string;
}

export interface PublicQuestionFilterQuery {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  levelId?: string;
  technologyId?: string;
  difficulty?: Difficulty;
  questionType?: QuestionType;
  type?: QuestionType;
}

export interface PublicTaxonomyDto {
  roles: PublicTaxonomyItem[];
  levels: PublicTaxonomyItem[];
  technologies: PublicTechnologyItem[];
}

export interface IPublicQuestionService {
  listPublicQuestions(query: PublicQuestionFilterQuery): Promise<PaginatedPublicQuestionsDto>;
  getPublicQuestionDetail(id: string): Promise<PublicQuestionDetailDto | null>;
  getPublicTaxonomy(roleId?: string): Promise<PublicTaxonomyDto>;
}
