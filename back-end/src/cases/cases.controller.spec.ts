import { Test, TestingModule } from '@nestjs/testing';
import { CasesController } from './cases.controller';

describe('CasesController', () => {
  let controller: CasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesController],
    }).compile();

    controller = module.get<CasesController>(CasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
