import dotenv from 'dotenv';

// Carrega .env.local prioritariamente para desenvolvimento local e .env como fallback
dotenv.config({ path: ['.env.local', '.env'] });
