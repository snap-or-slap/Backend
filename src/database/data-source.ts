import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
	type: 'postgres',
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '5432', 10),
	username: process.env.DB_USERNAME || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'sos1_db',
	entities: ['dist/**/*.entity.js'],
	migrations: ['dist/database/migrations/*.js'],
	synchronize: false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
