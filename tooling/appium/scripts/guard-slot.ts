#!/usr/bin/env node
import { parseSlot, assertRngmaSlotAllowed } from '../src/slots.ts';

const slot = parseSlot(process.env.RNGMA_E2E_SLOT);
if (slot != null) {
  assertRngmaSlotAllowed(slot);
}
