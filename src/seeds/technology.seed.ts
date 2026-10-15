import Technology from '../models/technology.model';
import Role from '../models/role.model';

const technologies = [
  // Frontend
  { code: 'JAVASCRIPT', name: 'JavaScript', roles: ['FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'TYPESCRIPT', name: 'TypeScript', roles: ['FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'REACT', name: 'React', roles: ['FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'VUEJS', name: 'Vue.js', roles: ['FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'ANGULAR', name: 'Angular', roles: ['FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'HTML_CSS', name: 'HTML/CSS', roles: ['FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'UI_UX_DESIGNER'] },
  { code: 'TAILWIND', name: 'Tailwind CSS', roles: ['FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'UI_UX_DESIGNER'] },

  // Backend
  { code: 'NODEJS', name: 'Node.js', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'EXPRESS', name: 'Express.js', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'NESTJS', name: 'NestJS', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'SPRING_BOOT', name: 'Spring Boot (Java)', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'DJANGO', name: 'Django (Python)', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'DATA_SCIENTIST'] },
  { code: 'ASPNET', name: 'ASP.NET (C#)', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'GOLANG', name: 'Go', roles: ['BACKEND_DEVELOPER', 'DEVOPS_ENGINEER', 'CLOUD_ARCHITECT'] },
  { code: 'MESSAGE_QUEUE', name: 'Message Queue', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'DEVOPS_ENGINEER', 'CLOUD_ARCHITECT'] },
  
  // Database
  { code: 'POSTGRESQL', name: 'PostgreSQL', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'DATA_ENGINEER'] },
  { code: 'MONGODB', name: 'MongoDB', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'DATA_ENGINEER'] },
  { code: 'REDIS', name: 'Redis', roles: ['BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'DEVOPS_ENGINEER'] },

  // DevOps & Cloud
  { code: 'DOCKER', name: 'Docker', roles: ['DEVOPS_ENGINEER', 'BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'CLOUD_ARCHITECT'] },
  { code: 'KUBERNETES', name: 'Kubernetes', roles: ['DEVOPS_ENGINEER', 'CLOUD_ARCHITECT'] },
  { code: 'AWS', name: 'AWS', roles: ['DEVOPS_ENGINEER', 'CLOUD_ARCHITECT', 'BACKEND_DEVELOPER', 'DATA_ENGINEER'] },
  { code: 'TERRAFORM', name: 'Terraform', roles: ['DEVOPS_ENGINEER', 'CLOUD_ARCHITECT'] },
  { code: 'CI_CD', name: 'CI/CD', roles: ['DEVOPS_ENGINEER', 'CLOUD_ARCHITECT'] },

  // Mobile
  { code: 'REACT_NATIVE', name: 'React Native', roles: ['MOBILE_DEVELOPER'] },
  { code: 'FLUTTER', name: 'Flutter', roles: ['MOBILE_DEVELOPER'] },
  { code: 'SWIFT', name: 'Swift (iOS)', roles: ['MOBILE_DEVELOPER'] },
  { code: 'KOTLIN', name: 'Kotlin (Android)', roles: ['MOBILE_DEVELOPER'] },

  // Data & AI
  { code: 'PYTHON', name: 'Python', roles: ['DATA_SCIENTIST', 'DATA_ENGINEER', 'BACKEND_DEVELOPER', 'DEVOPS_ENGINEER', 'SECURITY_ENGINEER'] },
  { code: 'PYTORCH', name: 'PyTorch', roles: ['DATA_SCIENTIST'] },
  { code: 'TENSORFLOW', name: 'TensorFlow', roles: ['DATA_SCIENTIST'] },
  { code: 'SPARK', name: 'Apache Spark', roles: ['DATA_ENGINEER', 'DATA_SCIENTIST'] },

  // QA
  { code: 'SELENIUM', name: 'Selenium', roles: ['QA_ENGINEER'] },
  { code: 'CYPRESS', name: 'Cypress', roles: ['QA_ENGINEER', 'FRONTEND_DEVELOPER'] },
  { code: 'JEST', name: 'Jest', roles: ['QA_ENGINEER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER'] },
  
  // Security
  { code: 'WEB_SECURITY', name: 'Web Security', roles: ['SECURITY_ENGINEER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'FULLSTACK_DEVELOPER'] },
  { code: 'KALI_LINUX', name: 'Kali Linux', roles: ['SECURITY_ENGINEER'] },
  { code: 'BURP_SUITE', name: 'Burp Suite', roles: ['SECURITY_ENGINEER'] },
  
  // UI/UX & PM
  { code: 'FIGMA', name: 'Figma', roles: ['UI_UX_DESIGNER', 'PRODUCT_MANAGER'] },
  { code: 'JIRA', name: 'Jira', roles: ['PRODUCT_MANAGER', 'BUSINESS_ANALYST', 'SCRUM_MASTER', 'QA_ENGINEER'] },
];

export const seedTechnologies = async () => {
  console.log('🔄 Đang seed dữ liệu Technology...');
  
  // Lấy tất cả roles để map code sang _id
  const rolesInDb = await Role.find();
  const roleMap = new Map();
  rolesInDb.forEach(r => roleMap.set(r.code, r._id));

  for (const tech of technologies) {
    const roleIds = tech.roles.map(code => roleMap.get(code)).filter(Boolean); // Lọc ra những _id hợp lệ
    
    const payload = {
      code: tech.code,
      name: tech.name,
      roles: roleIds,
    };

    await Technology.findOneAndUpdate(
      { code: tech.code },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Đã seed dữ liệu Technology');
};
