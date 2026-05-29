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

@Module({
  imports: [
    // Serves the index.html UI at http://localhost:3000
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    PeopleModule,
    SkillsModule,
    ProjectsModule,
  ],
})
export class AppModule {}
