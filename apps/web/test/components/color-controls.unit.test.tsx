import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox, SegmentedControl, SegmentedControlItem, Switch, TableRow } from "@lazuli/ui";
import { ThemeToggle } from "../../src/components/app-shell/theme-toggle.js";
import { ProjectionCode } from "../../src/features/student-attendance/projection-code.js";

void it("renders the staff theme action as a native button with both theme-specific names", () => {
  const markup = renderToStaticMarkup(<ThemeToggle />);
  assert.match(markup, /^<button\b[^>]*type="button"/u);
  assert.match(markup, /Ativar tema claro/u);
  assert.match(markup, /Ativar tema escuro/u);
});

void it("exposes row and form selection independently of fill colors", () => {
  const markup = renderToStaticMarkup(
    <>
      <table>
        <tbody>
          <TableRow selected>
            <td>Selecionada</td>
          </TableRow>
        </tbody>
      </table>
      <Checkbox defaultChecked aria-label="Selecionar parcela" />
      <Switch defaultChecked aria-label="Presença" />
      <SegmentedControl value="week" onValueChange={() => {}} aria-label="Período">
        <SegmentedControlItem value="day">Dia</SegmentedControlItem>
        <SegmentedControlItem value="week">Semana</SegmentedControlItem>
      </SegmentedControl>
    </>,
  );
  assert.match(markup, /<tr[^>]+aria-selected="true"/u);
  const checked = markup.match(/<[^>]+aria-checked="true"[^>]*>/gu) ?? [];
  assert.ok(checked.some((control) => control.includes('role="switch"')));
  assert.ok(checked.some((control) => control.includes('role="checkbox"')));
  assert.match(markup, /<button[^>]+aria-pressed="true"[^>]*>Semana</u);
  assert.match(markup, /<button[^>]+aria-pressed="false"[^>]*>Dia</u);
});

void it("renders the projected attendance code with black modules on opaque white", () => {
  const markup = renderToStaticMarkup(
    <ProjectionCode title="Prévia" url="https://example.test/presenca/previa" />,
  );
  assert.match(markup, /<path fill="#FFFFFF"/iu);
  assert.match(markup, /<path fill="#000000"/iu);
});
