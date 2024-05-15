#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Run database migrations
echo "Running migrations..."
python manage.py migrate

# Start the Django development server
echo "Starting the development server..."
python manage.py runserver 0.0.0.0:8000
