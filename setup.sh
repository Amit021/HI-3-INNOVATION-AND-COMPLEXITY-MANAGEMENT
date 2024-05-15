#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e


# Start the Django development server
echo "Starting the development server..."
python manage.py runserver 0.0.0.0:8000
