export async function deleteDemoData(db: D1Database): Promise<{ vendors: number; analyses: number }> {
  const vendorRows = await db.prepare(`SELECT id FROM vendors WHERE is_demo = 1`).all<{ id: string }>();
  const analysisRows = await db.prepare(`SELECT id FROM email_analyses WHERE is_demo = 1`).all<{ id: string }>();
  const vendorIds = (vendorRows.results ?? []).map((row) => row.id);
  const analysisIds = (analysisRows.results ?? []).map((row) => row.id);
  if (analysisIds.length > 0) {
    const marks = analysisIds.map(() => "?").join(", ");
    await db.prepare(`DELETE FROM review_events WHERE analysis_id IN (${marks})`).bind(...analysisIds).run();
    await db.prepare(`DELETE FROM findings WHERE analysis_id IN (${marks})`).bind(...analysisIds).run();
    await db.prepare(`DELETE FROM vendor_observations WHERE analysis_id IN (${marks})`).bind(...analysisIds).run();
  }
  if (vendorIds.length > 0) {
    const marks = vendorIds.map(() => "?").join(", ");
    await db.prepare(`DELETE FROM vendor_observations WHERE vendor_id IN (${marks})`).bind(...vendorIds).run();
    await db.prepare(`UPDATE email_analyses SET vendor_id = NULL WHERE vendor_id IN (${marks}) AND is_demo = 0`).bind(...vendorIds).run();
    await db.prepare(`DELETE FROM email_analyses WHERE is_demo = 1`).run();
    await db.prepare(`DELETE FROM vendor_sender_identities WHERE vendor_id IN (${marks})`).bind(...vendorIds).run();
    await db.prepare(`DELETE FROM vendor_domains WHERE vendor_id IN (${marks})`).bind(...vendorIds).run();
    await db.prepare(`DELETE FROM vendor_internal_recipients WHERE vendor_id IN (${marks})`).bind(...vendorIds).run();
    await db.prepare(`DELETE FROM vendors WHERE is_demo = 1`).run();
  } else if (analysisIds.length > 0) {
    await db.prepare(`DELETE FROM email_analyses WHERE is_demo = 1`).run();
  }
  return { vendors: vendorIds.length, analyses: analysisIds.length };
}

export async function demoVendorCount(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM vendors WHERE is_demo = 1`).first<{ total: number }>();
  return row?.total ?? 0;
}
