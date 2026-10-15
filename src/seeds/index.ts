import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedUsers } from './user.seed';
import { seedRoles } from './role.seed';
import { seedLevels } from './level.seed';
import { seedTechnologies } from './technology.seed';
import { seedSystemPrompts } from './system-prompt.seed';
import { seedQuestionBank } from './question-bank.seed';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/it-interview-ai';

const runSeeder = async () => {
  try {
    console.log(' Đang kết nối Database...');
    await mongoose.connect(MONGO_URI);
    console.log(' Đã kết nối Database');

    console.log('====================================');
    // Chạy tuần tự các seeder
    await seedUsers();
    await seedLevels();
    await seedRoles();
    await seedTechnologies(); // Chạy sau role để lấy ID của role
    await seedSystemPrompts();
    await seedQuestionBank();
    console.log('====================================');

    console.log(' Đã hoàn tất toàn bộ quá trình Seed!');
  } catch (error) {
    console.error(' Quá trình Seed thất bại:', error);
  } finally {
    await mongoose.disconnect();
    console.log(' Đã ngắt kết nối Database');
    process.exit(0); // Bắt buộc thoát chương trình sau khi chạy xong
  }
};

runSeeder();
