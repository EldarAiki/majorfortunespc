const ExcelJS = require('exceljs');
const path = require('path');

async function inspect() {
    const base = path.resolve(__dirname, '..');
    const filePath = path.join(base, 'example_data', 't(1).xlsx');
    console.log('Reading:', filePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log('\nAll sheet names:', workbook.worksheets.map((s) => s.name));

    const ringSheet = workbook.getWorksheet('Union Ring Game Detail');
    if (!ringSheet) {
        console.log('\nUnion Ring Game Detail: NOT FOUND');
        return;
    }
    console.log('\n--- Union Ring Game Detail ---');
    console.log('Row count:', ringSheet.rowCount);
    for (let i = 1; i <= Math.min(15, ringSheet.rowCount || 12); i++) {
        const row = ringSheet.getRow(i);
        const values = [];
        for (let c = 1; c <= 12; c++) {
            const v = row.getCell(c).value;
            values.push(v === undefined || v === null ? '' : String(v).slice(0, 30));
        }
        console.log(`Row ${i}:`, values.map((v, idx) => `[${idx + 1}]${v}`).join(' | '));
    }
    console.log('\n--- Union Member Statistics (first 8 rows, key columns) ---');
    const memberSheet = workbook.getWorksheet('Union Member Statistics');
    if (memberSheet) {
        for (let i = 1; i <= 8; i++) {
            const row = memberSheet.getRow(i);
            const vals = [1, 3, 4, 5, 6, 9, 10, 38, 65].map((c) => row.getCell(c).value);
            console.log(`Row ${i} cols 1,3-6,9,10,38,65:`, vals);
        }
    }
}

inspect().catch(console.error);
