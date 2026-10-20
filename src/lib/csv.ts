export function csvCell(value:string|number):string {
  let text=String(value);
  if(/^[\s]*[=+\-@\t\r]/.test(text))text=`'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}

export function csvResponse(rows:string[][],filename:string):Response {
  const body=["\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n"),""].join("\r\n");
  return new Response(body,{
    headers:{
      "Content-Type":"text/csv; charset=utf-8",
      "Content-Disposition":`attachment; filename="${filename}"`,
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
