import { LawFirmsService } from './law-firms.service';
import { UsersService } from '../users/users.service';

describe('LawFirmsService', () => {
  let usersService: UsersService;
  let service: LawFirmsService;

  beforeEach(() => {
    usersService = new UsersService();
    service = new LawFirmsService(usersService);
    service.onModuleInit();
  });

  it('should include newly created firms without restarting', () => {
    usersService.createFirm({
      name: 'New Legal Partners',
      email: 'hello@newlegalpartners.com',
      phone: '9999999999',
      street: '12 Market Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      primaryEmail: 'hello@newlegalpartners.com',
      website: 'https://newlegalpartners.com',
      subtitle: 'Corporate & Civil Law',
      description: 'A new firm created during testing.',
      practiceArea: 'corporate',
    });

    const results = service.findAll({});

    expect(results.some((firm) => firm.name === 'New Legal Partners')).toBe(true);
  });
});
