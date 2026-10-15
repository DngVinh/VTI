export interface JdValidationResult {
  isValid: boolean;
  score: number;
  reason?: string;
  matchedRecruitmentKeywords: string[];
  matchedTechnicalKeywords: string[];
}

export class JdValidatorService {
  public static readonly MIN_LENGTH = 150;
  public static readonly MIN_RECRUITMENT_KEYWORDS = 2;
  public static readonly MIN_TECHNICAL_KEYWORDS = 2;

  private static readonly RECRUITMENT_KEYWORDS = [
    // Tiếng Việt
    'mô tả công việc',
    'yêu cầu công việc',
    'yêu cầu ứng viên',
    'yêu cầu',
    'trách nhiệm',
    'quyền lợi',
    'phúc lợi',
    'kinh nghiệm',
    'vị trí',
    'tuyển dụng',
    'chức danh',
    'kỹ năng',
    'mức lương',
    'chế độ',
    'đãi ngộ',
    // Tiếng Anh
    'job description',
    'responsibilities',
    'requirements',
    'qualifications',
    'skills',
    'benefits',
    'overview',
    'about the role',
    'what you will do',
    "what you'll do",
    'what we are looking for',
    "what we're looking for",
    'experience',
    'position',
    'salary',
    'compensation',
    'is hiring',
    'we are hiring',
  ];

  private static readonly TECHNICAL_KEYWORDS = [
    // Roles & Titles
    'developer',
    'engineer',
    'programmer',
    'lập trình',
    'kỹ sư phần mềm',
    'kỹ sư',
    'architect',
    'tech lead',
    'devops',
    'tester',
    'qa',
    'qc',
    'frontend',
    'backend',
    'fullstack',
    'full stack',
    // Technologies & Concepts
    'software',
    'phần mềm',
    'mã nguồn',
    'web',
    'mobile',
    'api',
    'restful',
    'rest api',
    'graphql',
    'database',
    'csdl',
    'sql',
    'nosql',
    'mongodb',
    'postgresql',
    'postgres',
    'mysql',
    'redis',
    'node',
    'nodejs',
    'node.js',
    'javascript',
    'typescript',
    'react',
    'reactjs',
    'react.js',
    'next.js',
    'nextjs',
    'vue',
    'vuejs',
    'angular',
    'python',
    'java',
    'golang',
    'c#',
    '.net',
    'php',
    'docker',
    'kubernetes',
    'aws',
    'azure',
    'gcp',
    'ci/cd',
    'ci-cd',
    'git',
    'microservices',
    'architecture',
    'kiến trúc',
    'agile',
    'scrum',
  ];

  /**
   * Validate raw text extracted from uploaded JD file.
   */
  public static validate(text: string): JdValidationResult {
    const trimmed = (text || '').trim();

    if (trimmed.length < this.MIN_LENGTH) {
      return {
        isValid: false,
        score: 0,
        reason: `Nội dung tệp quá ngắn (tối thiểu ${this.MIN_LENGTH} ký tự). Vui lòng cung cấp bản mô tả công việc hoàn chỉnh.`,
        matchedRecruitmentKeywords: [],
        matchedTechnicalKeywords: [],
      };
    }

    const normalizedText = trimmed.toLowerCase();

    // Check recruitment signals
    const matchedRecruitment = this.RECRUITMENT_KEYWORDS.filter((keyword) =>
      normalizedText.includes(keyword)
    );

    // Check technical signals
    const matchedTechnical = this.TECHNICAL_KEYWORDS.filter((keyword) => {
      // Use boundary-safe checks for short keywords
      if (keyword.length <= 4 && !keyword.includes('.')) {
        const regex = new RegExp(`(?:^|\\W)${keyword}(?:$|\\W)`, 'i');
        return regex.test(normalizedText);
      }
      return normalizedText.includes(keyword);
    });

    const recruitmentCount = matchedRecruitment.length;
    const technicalCount = matchedTechnical.length;
    const score = recruitmentCount * 1.5 + technicalCount * 1.0;

    if (recruitmentCount < this.MIN_RECRUITMENT_KEYWORDS) {
      return {
        isValid: false,
        score,
        reason:
          'Nội dung tệp thiếu các mục thông tin cấu trúc tuyển dụng (như Mô tả công việc, Yêu cầu, Trách nhiệm, Quyền lợi).',
        matchedRecruitmentKeywords: matchedRecruitment,
        matchedTechnicalKeywords: matchedTechnical,
      };
    }

    if (technicalCount < this.MIN_TECHNICAL_KEYWORDS) {
      return {
        isValid: false,
        score,
        reason:
          'Nội dung tệp không chứa đủ thuật ngữ kỹ thuật hoặc vai trò công nghệ thông tin liên quan.',
        matchedRecruitmentKeywords: matchedRecruitment,
        matchedTechnicalKeywords: matchedTechnical,
      };
    }

    return {
      isValid: true,
      score,
      matchedRecruitmentKeywords: matchedRecruitment,
      matchedTechnicalKeywords: matchedTechnical,
    };
  }
}
