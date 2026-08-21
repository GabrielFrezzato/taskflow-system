"""
conftest.py — Configuração global do pytest
Ajusta o sys.path para que os imports do backend funcionem
tanto localmente quanto no CI do GitHub Actions.
"""

import sys
import os

# Garante que o root do projeto está no path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
