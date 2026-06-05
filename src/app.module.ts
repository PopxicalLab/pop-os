// The ROOT module ties the whole app together. Right now it pulls in
// the People module and serves the static web page from /public.
// As we add Projects, Capacity, Assets, etc., each gets its own module
// and gets imported here.
import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    // Serves the index.html UI at http://localhost:3000
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
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
  ],
})
export class AppModule {}
