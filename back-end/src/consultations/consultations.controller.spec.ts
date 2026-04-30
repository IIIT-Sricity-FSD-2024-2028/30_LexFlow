import { Test, TestingModule } from '@nestjs/testing';
import { ConsultationsController } from './consultations.controller';

describe('ConsultationsController', () => {
  let controller: ConsultationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultationsController],
    }).compile();

    controller = module.get<ConsultationsController>(ConsultationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
