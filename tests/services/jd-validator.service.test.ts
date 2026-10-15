import { describe, it, expect } from 'vitest';
import { JdValidatorService } from '../../src/services/ai/JdValidatorService';

describe('JdValidatorService', () => {
  it('rejects text that is too short (< 150 characters)', () => {
    const shortText = 'Tuyển dụng Developer NodeJS. Yêu cầu có kinh nghiệm.';
    const result = JdValidatorService.validate(shortText);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('quá ngắn');
  });

  it('rejects completely unrelated content (e.g. cooking recipe)', () => {
    const cookingRecipe = `
      Hướng dẫn nấu món phở bò truyền thống thơm ngon đậm đà tại nhà:
      Chuẩn bị nguyên liệu: 1kg xương ống bò, 500g thịt bò phi lê, 1 củ gừng, 3 củ hành tím, hoa hồi, quế, thảo quả.
      Cách làm: Xương ống rửa sạch, chần qua nước sôi rồi ninh trong 6 tiếng để lấy nước dùng trong và ngọt.
      Nướng thơm gừng và hành tím rồi thả vào nồi nước dùng cùng các gia vị hồi quế.
      Thịt bò thái lát mỏng, chần tái. Bánh phở trần qua nước sôi rồi xếp vào tô, thêm hành lá và chan nước dùng nóng.
    `;
    const result = JdValidatorService.validate(cookingRecipe);

    expect(result.isValid).toBe(false);
    expect(result.matchedTechnicalKeywords.length).toBeLessThan(2);
  });

  it('rejects technical code/log snippets without recruitment structure', () => {
    const codeSnippet = `
      import express from 'express';
      import mongoose from 'mongoose';
      import dotenv from 'dotenv';
      
      dotenv.config();
      const app = express();
      app.use(express.json());
      
      app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
      });
      
      mongoose.connect(process.env.MONGO_URI as string)
        .then(() => console.log('Database connected successfully'))
        .catch((err) => console.error('Connection error:', err));
        
      app.listen(3000, () => console.log('Server running on port 3000'));
    `;
    const result = JdValidatorService.validate(codeSnippet);

    expect(result.isValid).toBe(false);
    expect(result.matchedRecruitmentKeywords.length).toBeLessThan(2);
  });

  it('accepts valid Vietnamese IT Job Description', () => {
    const vietnameseJd = `
      CÔNG TY TNHH PHẦN MỀM ABC TUYỂN DỤNG
      Vị trí: Lập trình viên Backend NodeJS (Middle / Senior)
      
      Mô tả công việc:
      - Thiết kế và phát triển các dịch vụ API, Microservices hiệu năng cao sử dụng Node.js, TypeScript.
      - Tối ưu hóa truy vấn cơ sở dữ liệu MongoDB và Redis Cache.
      - Phối hợp với đội ngũ Frontend và QA để hoàn thiện tính năng sản phẩm.
      
      Yêu cầu công việc:
      - Có từ 2 năm kinh nghiệm lập trình Backend với Node.js / JavaScript / TypeScript.
      - Nắm vững kiến trúc phần mềm, RESTful API và cơ sở dữ liệu quan hệ hoặc NoSQL.
      - Có kinh nghiệm sử dụng Docker, Git và quy trình CI/CD là một lợi thế lớn.
      
      Quyền lợi được hưởng:
      - Mức lương cạnh tranh từ 20M - 40M VND theo năng lực.
      - Đầy đủ chế độ bảo hiểm và thưởng tháng lương thứ 13.
    `;
    const result = JdValidatorService.validate(vietnameseJd);

    expect(result.isValid).toBe(true);
    expect(result.matchedRecruitmentKeywords.length).toBeGreaterThanOrEqual(2);
    expect(result.matchedTechnicalKeywords.length).toBeGreaterThanOrEqual(2);
  });

  it('accepts valid English IT Job Description', () => {
    const englishJd = `
      Company XYZ is hiring a Senior Full Stack Engineer!
      
      About the Role & Responsibilities:
      - Architect and implement robust web applications using React, Next.js, and Node.js backend services.
      - Design scalable data models and write efficient queries for PostgreSQL and Redis.
      - Mentor junior developers, conduct code reviews, and champion engineering best practices.
      
      Qualifications & Requirements:
      - 4+ years of professional software engineering experience with modern JavaScript, TypeScript, and React.
      - Solid understanding of REST APIs, cloud infrastructure on AWS or GCP, and CI/CD pipelines.
      - Bachelor's degree in Computer Science or equivalent practical experience.
      
      Benefits & Compensation:
      - Competitive salary package with annual performance bonus.
      - Remote-first working culture and flexible hours.
    `;
    const result = JdValidatorService.validate(englishJd);

    expect(result.isValid).toBe(true);
    expect(result.matchedRecruitmentKeywords.length).toBeGreaterThanOrEqual(2);
    expect(result.matchedTechnicalKeywords.length).toBeGreaterThanOrEqual(2);
  });
});
