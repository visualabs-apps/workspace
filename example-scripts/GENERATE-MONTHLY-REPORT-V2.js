console.log('📊 Monthly Report Generator\n');

const inputResult = await vbox.openInput({
    title: 'Generate Monthly Report',
    fields: [
        {
            name: 'clientName',
            label: 'Client Name',
            type: 'text',
            required: true,
            description: 'Nama client untuk report'
        },
        {
            name: 'reportPeriod',
            label: 'Report Period',
            type: 'daterange',
            required: true,
            defaultValue: {
                start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
            },
            description: 'Periode report (maksimal 1 bulan)'
        }
    ]
});

if (!inputResult?.success) {
    vbox.toast('Report generation cancelled', 'info');
    return { success: false, message: 'Cancelled by user' };
}

const { clientName, reportPeriod } = inputResult.data;
const startDate = new Date(reportPeriod.start);
const endDate = new Date(reportPeriod.end);

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                         'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const monthYear = `${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;

const year = startDate.getFullYear();
const month = startDate.getMonth();

const week1Start = new Date(year, month, 1);
const week1End = new Date(year, month, 15);
const week2Start = new Date(year, month, 16);
const week2End = new Date(year, month + 1, 0);

const formatWeek = (start, end) => {
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = monthNamesShort[start.getMonth()];
    const endMonth = monthNamesShort[end.getMonth()];
    return start.getMonth() === end.getMonth() 
        ? `${startDay}-${endDay} ${endMonth}`
        : `${startDay} ${startMonth}-${endDay} ${endMonth}`;
};

const variables = {
    clientName: clientName,
    MonthYear: monthYear,
    week1perform: formatWeek(week1Start, week1End),
    week2perform: formatWeek(week2Start, week2End)
};

console.log('📝 Variables:', variables, '\n');

vbox.toast('Generating report...', 'info');

const outputFilename = `MonthlyReport_${clientName.replace(/\s+/g, '_')}_${monthYear.replace(/\s+/g, '_')}_${Date.now()}.pptx`;

const result = await vbox.ppt.useTemplate('MonthlyReport.pptx', variables, outputFilename);

if (result?.success) {
    console.log('✅ Report generated:', result.filename);
    vbox.toast(`Report generated: ${result.filename}`, 'success');
    return { success: true, data: { filename: result.filename, path: result.path, variables } };
} else {
    console.error('❌ Failed:', result?.error);
    vbox.toast('Failed to generate report', 'error');
    return { success: false, error: result?.error };
}
