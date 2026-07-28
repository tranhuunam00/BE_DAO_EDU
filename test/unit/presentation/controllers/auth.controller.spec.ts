import { AuthController } from '../../../../src/presentation/controllers/auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let registerUseCase: { execute: jest.Mock };
  let loginUseCase: { execute: jest.Mock };
  let refreshTokenUseCase: { execute: jest.Mock };

  beforeEach(() => {
    registerUseCase = { execute: jest.fn() };
    loginUseCase = { execute: jest.fn() };
    refreshTokenUseCase = { execute: jest.fn() };

    controller = new AuthController(
      registerUseCase as any,
      loginUseCase as any,
      refreshTokenUseCase as any,
    );
  });

  it('delegates user registration to RegisterUseCase', async () => {
    const dto = { email: 'admin@dao.edu.vn', password: 'password123', name: 'Admin', role: 'ADMIN' as any };
    registerUseCase.execute.mockResolvedValue({ id: 'user-1', email: dto.email });

    const result = await controller.register(dto);
    expect(registerUseCase.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'user-1', email: dto.email });
  });

  it('delegates user login to LoginUseCase', async () => {
    const dto = { email: 'admin@dao.edu.vn', password: 'password123' };
    const authResponse = { accessToken: 'jwt-access', refreshToken: 'jwt-refresh', user: { id: 'user-1' } };
    loginUseCase.execute.mockResolvedValue(authResponse);

    const result = await controller.login(dto);
    expect(loginUseCase.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResponse);
  });

  it('delegates token refresh to RefreshTokenUseCase', async () => {
    const dto = { refreshToken: 'valid-refresh-token' };
    const tokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
    refreshTokenUseCase.execute.mockResolvedValue(tokens);

    const result = await controller.refresh(dto);
    expect(refreshTokenUseCase.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual(tokens);
  });
});
