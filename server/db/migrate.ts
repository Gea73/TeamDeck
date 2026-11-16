import '../config/env';
import { closePool, getPool } from './pool';
import {
  getAppliedMigrations,
  loadMigrations,
  rollbackMigrations,
  runPendingMigrations,
} from './migrator';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'up';
  const useTestDb = args.includes('--test') || process.env.NODE_ENV === 'test';
  const stepsArg = args.find((a) => a.startsWith('--steps='));
  const steps = stepsArg ? Number(stepsArg.split('=')[1]) : 1;

  const pool = getPool({ testMode: useTestDb });

  try {
    if (command === 'up') {
      const result = await runPendingMigrations({ pool });
      console.log(
        `[TeamDeck Migrate] Aplicadas: ${result.applied.length} (${
          result.applied.join(', ') || 'nenhuma'
        }) | Já aplicadas: ${result.skipped.length}`
      );
      return;
    }

    if (command === 'down') {
      const result = await rollbackMigrations({
        pool,
        steps: Number.isInteger(steps) && steps > 0 ? steps : 1,
      });
      console.log(
        `[TeamDeck Migrate] Revertidas: ${result.rolledBack.length} (${
          result.rolledBack.join(', ') || 'nenhuma'
        })`
      );
      return;
    }

    if (command === 'status') {
      const all = loadMigrations();
      const applied = await getAppliedMigrations(pool);
      const appliedSet = new Set(applied.map((a) => a.version));
      for (const m of all) {
        const state = appliedSet.has(m.version) ? 'APLICADA' : 'PENDENTE';
        console.log(`- ${m.version}_${m.name}: ${state}`);
      }
      return;
    }

    console.error(`Comando desconhecido: ${command}. Use: up | down | status`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error(
    '[TeamDeck Migrate] Erro:',
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
