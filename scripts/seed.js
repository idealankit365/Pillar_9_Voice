import { buildConfig } from '../src/config.js';
import { Repository, seedRepository } from '../src/db.js';

const config=buildConfig();const repo=new Repository(config.databasePath);seedRepository(repo,config);console.log(JSON.stringify({ok:true,databasePath:config.databasePath,contacts:repo.listContacts().length,listings:repo.listListings().length},null,2));repo.close();
