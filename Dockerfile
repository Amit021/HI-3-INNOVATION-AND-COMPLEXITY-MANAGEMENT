# Use the official Python image as a base image
FROM python:3.11

# Set the working directory in the container
WORKDIR /workspace

# Copy the requirements file into the container
COPY requirements.txt /workspace/

# Install dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy the rest of the application code into the container
COPY . /workspace/

# Expose port 8000 for the Django development server
EXPOSE 8000

# Run the Django development server on port 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
