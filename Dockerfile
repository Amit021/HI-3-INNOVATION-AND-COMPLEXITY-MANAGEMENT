# Use the official Python image as a base image
FROM python:3.11

# Set environment variables to prevent .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /workspaces/HI-3-INNOVATION-AND-COMPLEXITY-MANAGEMENT

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose port 8000 for the Django development server
EXPOSE 8000

# Run the Django development server
CMD ["./setup.sh"]
