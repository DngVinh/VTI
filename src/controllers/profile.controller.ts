import { Request, Response } from 'express';
import { getCurrentProfile, updateCurrentProfile } from '../services/profile.service';
import { ApiResponse } from '../types/response.type';
import { SafeUser } from '../types/auth.type';

export const getProfileHandler = async (req: Request, res: Response): Promise<void> => {
  const profile = await getCurrentProfile(req.user!._id.toString());
  const response: ApiResponse<SafeUser> = { success: true, data: profile };
  res.status(200).json(response);
};

export const updateProfileHandler = async (req: Request, res: Response): Promise<void> => {
  const profile = await updateCurrentProfile(req.user!._id.toString(), req.body);
  const response: ApiResponse<SafeUser> = {
    success: true,
    message: 'Cập nhật hồ sơ thành công',
    data: profile,
  };
  res.status(200).json(response);
};

export const uploadAvatarHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      code: 'BAD_REQUEST',
      message: 'Vui lòng chọn tệp ảnh hợp lệ để tải lên',
    });
    return;
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const profile = await updateCurrentProfile(req.user!._id.toString(), {
    avatarUrl,
  });

  const response: ApiResponse<{ avatarUrl: string; user: SafeUser }> = {
    success: true,
    message: 'Tải ảnh đại diện thành công',
    data: {
      avatarUrl,
      user: profile,
    },
  };
  res.status(200).json(response);
};

