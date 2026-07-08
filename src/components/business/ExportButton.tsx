import { Button } from "../ui/Button";
import { IconDownload } from "../ui/icons";
import { exportToCsv, type CsvColumn } from "../../utils/exportCsv";
import { useToast } from "../../context/ToastContext";

interface ExportButtonProps<T> {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  label?: string;
}

/** Botón reutilizable para exportar una tabla a CSV (Excel). */
export function ExportButton<T>({
  filename,
  rows,
  columns,
  label = "Exportar",
}: ExportButtonProps<T>) {
  const toast = useToast();

  const handleExport = () => {
    if (rows.length === 0) {
      toast.warning("No hay filas para exportar con los filtros actuales.");
      return;
    }
    exportToCsv(filename, rows, columns);
    toast.success(
      `Se exportaron ${rows.length} fila${rows.length === 1 ? "" : "s"} a ${filename}.csv`
    );
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<IconDownload className="w-4 h-4" />}
      onClick={handleExport}
    >
      {label}
    </Button>
  );
}
