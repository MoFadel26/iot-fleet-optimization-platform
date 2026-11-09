"""
Production WSGI entrypoint.

Gunicorn imports `app` from this module (see Procfile). Running this file
directly starts Flask's dev server on $PORT (default 5001; macOS AirPlay
Receiver holds 5000).
"""

import os

from optimizer_api import app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
