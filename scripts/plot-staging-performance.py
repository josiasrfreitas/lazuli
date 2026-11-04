"""Render the staging benchmark charts from aggregate, PII-free JSON."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/performance"
SERVER = json.loads((OUT / "staging-general-2026-11-03.json").read_text())
BUNDLES = json.loads((OUT / "staging-client-bundles-2026-11-03.json").read_text())
BROWSER = json.loads((OUT / "staging-client-auth-browser-2026-11-03.json").read_text())

LABELS = {
    "home_admin": "Painel admin",
    "students_page25": "Alunos · 25",
    "classes_page20": "Turmas · 20",
    "receivables": "Recebíveis",
    "appointments_month": "Atendimentos · mês",
    "home_teacher": "Painel professor",
    "mixed": "Carga mista",
}


def duration(ms: float) -> str:
    return f"{ms / 1000:.2f} s" if ms >= 1000 else f"{ms:.0f} ms"


def save(fig: plt.Figure, filename: str, rect: tuple[float, float, float, float] | None = None) -> None:
    fig.tight_layout(rect=rect)
    fig.savefig(OUT / filename, format="svg", bbox_inches="tight")
    plt.close(fig)


def plot_p99_concurrency() -> None:
    names = [
        "classes_page20",
        "appointments_month",
        "home_teacher",
        "students_page25",
        "home_admin",
        "receivables",
    ]
    runs = {(row["scenario"], row["concurrency"]): row for row in SERVER["runs"]}
    y = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(10, 5.2))
    for offset, concurrency, color, label in [
        (-0.19, 1, "#284a74", "1 chamada por vez"),
        (0.19, 4, "#d58832", "4 chamadas simultâneas"),
    ]:
        values = [runs[(name, concurrency)]["p99"] for name in names]
        ax.barh(y + offset, values, height=0.34, color=color, label=label)
        for axis_y, value in zip(y + offset, values):
            ax.annotate(
                duration(value),
                (value, axis_y),
                xytext=(5, 0),
                textcoords="offset points",
                va="center",
                fontsize=8,
            )
    ax.set_yticks(y, [LABELS[name] for name in names])
    ax.set_xscale("log")
    ax.set_xlim(4, 11_000)
    ax.set_xlabel("Latência p99 por chamada (ms, escala logarítmica)")
    ax.set_title("Staging · p99 com 1 e 4 chamadas simultâneas")
    ax.legend(loc="lower right", frameon=False)
    ax.grid(axis="x", alpha=0.2)
    ax.set_axisbelow(True)
    save(fig, "staging-general-p99-concurrency-2026-11-03.svg")


def plot_percentiles() -> None:
    names = [
        "classes_page20",
        "home_teacher",
        "appointments_month",
        "students_page25",
        "home_admin",
        "mixed",
        "receivables",
    ]
    runs = {row["scenario"]: row for row in SERVER["runs"] if row["concurrency"] == 4}
    fig, ax = plt.subplots(figsize=(10, 5.4))
    for index, name in enumerate(names):
        row = runs[name]
        ax.plot([row["p50"], row["p99"]], [index, index], color="#b8c4d2", linewidth=3)
        ax.scatter(row["p50"], index, color="#284a74", s=36, zorder=3)
        ax.scatter(row["p95"], index, color="#6c94ae", s=36, zorder=3)
        ax.scatter(row["p99"], index, color="#cf6429", s=46, zorder=3)
        ax.annotate(
            duration(row["p99"]),
            (row["p99"], index),
            xytext=(5, 0),
            textcoords="offset points",
            va="center",
            fontsize=8,
        )
    ax.set_yticks(range(len(names)), [LABELS[name] for name in names])
    ax.set_xscale("log")
    ax.set_xlim(8, 11_000)
    ax.set_xlabel("Latência por chamada (ms, escala logarítmica)")
    ax.set_title("Staging · dispersão da latência com 4 chamadas simultâneas")
    ax.scatter([], [], color="#284a74", label="p50")
    ax.scatter([], [], color="#6c94ae", label="p95")
    ax.scatter([], [], color="#cf6429", label="p99")
    ax.legend(loc="lower right", frameon=False, ncol=3)
    ax.grid(axis="x", alpha=0.2)
    ax.set_axisbelow(True)
    save(fig, "staging-general-p99-tail-2026-11-03.svg")


def plot_client_weight() -> None:
    paths = [
        "/login",
        "/turmas",
        "/",
        "/financeiro",
        "/alunos",
        "/aulas",
        "/turmas/[id]",
        "/alunos/[id]",
    ]
    routes = {row["route"]: row for row in BUNDLES["routes"]}
    labels = ["Login", "Turmas", "Painel", "Financeiro", "Alunos", "Aulas", "Turma", "Aluno"]
    js = [routes[path]["js"]["brotliBytes"] / 1024 for path in paths]
    css = [routes[path]["css"]["brotliBytes"] / 1024 for path in paths]
    y = np.arange(len(paths))
    fig, ax = plt.subplots(figsize=(9.5, 5.5))
    ax.barh(y, js, color="#284a74", label="JavaScript")
    ax.barh(y, css, left=js, color="#d58832", label="CSS")
    for index, (js_kb, css_kb) in enumerate(zip(js, css)):
        ax.annotate(
            f"{js_kb + css_kb:.0f} KB",
            (js_kb + css_kb, index),
            xytext=(5, 0),
            textcoords="offset points",
            va="center",
            fontsize=8,
        )
    ax.set_yticks(y, labels)
    ax.set_xlim(0, max(j + c for j, c in zip(js, css)) * 1.17)
    ax.set_xlabel("KB estimados em Brotli · cache vazio")
    ax.set_title("Staging · arquivos iniciais do cliente por tela")
    ax.legend(loc="lower right", frameon=False)
    ax.grid(axis="x", alpha=0.2)
    ax.set_axisbelow(True)
    save(fig, "staging-client-weight-2026-11-03.svg")


def plot_client_runtime() -> None:
    paths = ["/", "/alunos", "/turmas", "/financeiro", "/aulas"]
    labels = ["Painel", "Alunos", "Turmas", "Financeiro", "Aulas"]
    rows = {(row["route"], row["mode"]): row for row in BROWSER["summary"]}
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.7), sharey=True)
    y = np.arange(len(paths))
    for ax, (metric, title) in zip(
        axes,
        [("lcpMs", "Maior elemento visível · LCP"), ("taskMs", "Tarefas na thread principal")],
    ):
        for offset, mode, color, label in [
            (-0.18, "desktop", "#284a74", "Desktop"),
            (0.18, "slow4g", "#d58832", "CPU 4× / 1,6 Mb/s"),
        ]:
            values = [rows[(path, mode)][metric]["p50"] for path in paths]
            ax.barh(y + offset, values, height=0.33, color=color, label=label)
        ax.set_title(title)
        ax.set_xlabel("Mediana de 5 navegações frias (ms)")
        ax.set_xlim(0, 2300)
        ax.grid(axis="x", alpha=0.2)
        ax.set_axisbelow(True)
    axes[0].set_yticks(y, labels)
    handles, legend_labels = axes[0].get_legend_handles_labels()
    fig.legend(
        handles,
        legend_labels,
        loc="lower center",
        bbox_to_anchor=(0.5, 0.02),
        frameon=False,
        ncol=2,
    )
    fig.suptitle("Staging · Chrome autenticado, cache desativado")
    save(fig, "staging-client-runtime-2026-11-03.svg", rect=(0, 0.12, 1, 0.91))


plot_p99_concurrency()
plot_percentiles()
plot_client_weight()
plot_client_runtime()
