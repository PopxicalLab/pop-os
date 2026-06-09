import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PeopleModule } from './people/people.module';
import { SkillsModule } from './skills/skills.module';
import { ProjectsModule } from './projects/projects.module';
import { CapacityModule } from './capacity/capacity.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PpmModule } from './ppm/ppm.module';
import { StaffingModule } from './staffing/staffing.module';
import { AssetsModule } from './assets/assets.module';
import { ProductionModule } from './production/production.module';
import { FinancialModule } from './financial/financial.module';
import { AccountsModule } from './accounts/accounts.module';
import { ContactsModule } from './contacts/contacts.module';
import { LeadsModule } from './leads/leads.module';
import { AutocountModule } from './autocount/autocount.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/jwt.guard';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    // Auth first — exports JwtModule so the global guard can use JwtService
    AuthModule,
    UsersModule,
    PeopleModule,
    SkillsModule,
    ProjectsModule,
    CapacityModule,
    DashboardModule,
    PpmModule,
    StaffingModule,
    AssetsModule,
    ProductionModule,
    FinancialModule,
    AccountsModule,
    ContactsModule,
    LeadsModule,
    AutocountModule,
  ],
  providers: [
    // Register JwtAuthGuard globally — every API route requires a valid JWT
    // unless the route handler is decorated with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
