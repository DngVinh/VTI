import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { featureFlags } from '../config/featureFlags';

export const HomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 selection:bg-indigo-500 selection:text-white flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Decorative blurred backgrounds */}
      <div className="absolute top-20 -left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-20 -right-10 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 max-w-3xl text-center">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-100 rounded-3xl mb-8 shadow-sm border border-indigo-50 transform hover:scale-105 transition-transform">
          <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight sm:text-6xl lg:text-7xl mb-6">
          <span className="block">VTI AI Interview</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mt-2">Nâng Tầm Kỹ Năng</span>
        </h1>
        
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto font-medium">
          Hệ thống mô phỏng phỏng vấn IT thông minh với Trí Tuệ Nhân Tạo, giúp bạn tự tin chinh phục mọi nhà tuyển dụng.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/setup"
            className="inline-flex justify-center items-center px-8 py-4 rounded-2xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all group overflow-hidden relative"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            Bắt đầu phỏng vấn
            <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
          
          <Link
            to={user ? '/profile' : '/login'}
            className="inline-flex justify-center items-center px-8 py-4 rounded-2xl text-lg font-bold text-slate-700 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 shadow-sm hover:shadow transition-all"
          >
            {user ? 'Hồ sơ cá nhân' : 'Đăng nhập'}
          </Link>

          <Link
            to="/questions"
            className="inline-flex justify-center items-center px-8 py-4 rounded-2xl text-lg font-bold text-indigo-700 bg-white hover:bg-indigo-50/60 border-2 border-indigo-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all"
          >
            📚 Ngân hàng câu hỏi
          </Link>

          {user?.role === 'ADMIN' && featureFlags.questionBankAdminUi && (
            <Link
              to="/admin/question-bank"
              className="inline-flex justify-center items-center px-8 py-4 rounded-2xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 transition-all"
            >
              Quản lý Question Bank
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
