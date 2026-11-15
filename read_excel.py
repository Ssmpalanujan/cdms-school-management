import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook(r'C:\Users\LEGION\Downloads\Grade6_Face_Drawing_Class_Score_Sheet.xlsx')
print('Sheet names:', wb.sheetnames)
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f'\n=== Sheet: {sheet_name} ===')
    print(f'Max row: {ws.max_row}, Max col: {ws.max_column}')
    for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 30), values_only=True):
        for cell in row:
            if cell is not None:
                print(f'  {cell}')