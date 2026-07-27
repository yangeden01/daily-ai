import ExcelJS from 'exceljs'

export class WorkbookService {
  createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Daily AI'
    workbook.created = new Date()
    workbook.modified = new Date()
    return workbook
  }

  async openWorkbook(data: ArrayBuffer | Uint8Array): Promise<ExcelJS.Workbook> {
    const workbook = this.createWorkbook()
    type WorkbookLoadData = Parameters<typeof workbook.xlsx.load>[0]
    await workbook.xlsx.load(data as unknown as WorkbookLoadData)
    return workbook
  }

  async saveWorkbook(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
    workbook.modified = new Date()
    const buffer = await workbook.xlsx.writeBuffer()
    return new Uint8Array(buffer)
  }
}
