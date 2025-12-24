#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# 1. Update system packages
echo "Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install dependencies (Git, Docker prerequisites)
echo "Installing dependencies..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

# 3. Install Docker
echo "Installing Docker..."
# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker

# 4 Install NVM and Node.js 24 LTS
echo "Installing NVM and Node.js 24..."
export NVM_DIR="$HOME/.nvm"

# Install NVM if not already installed
if [ ! -d "$NVM_DIR" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load NVM
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node 24
nvm install 24
nvm use 24
nvm alias default 24

# Ensure npm is up to date
npm install -g npm@latest

# 5. Clone the application
REPO_URL="https://github.com/svkanoria/kci-mis.git"
APP_DIR="/home/ubuntu/kci-mis"

echo "Setting up application at $APP_DIR..."

if [ -d "$APP_DIR" ]; then
    echo "Directory exists. Pulling latest changes..."
    cd "$APP_DIR"
    git pull
else
    echo "Cloning repository..."
    # Note: If your repo is private, you will need to set up SSH keys or use a Personal Access Token in the URL
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

npm install

npx drizzlekit migrate

# 6. Configure Environment Variables
if [ ! -f .env ]; then
    echo "Creating .env file with placeholder values..."
    cat <<EOF > .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=kci-mis
HOST_DB_PORT=5432
NEXT_PUBLIC_AG_GRID_LICENSE=your_ag_grid_license_key
EOF
    echo "Created .env file. Please update it with your actual secrets."
else
    echo ".env file already exists. Skipping creation."
fi

# 7. Install and Configure Nginx
if ! command -v nginx &> /dev/null; then
    echo "Installing and configuring Nginx..."
    sudo apt-get install -y nginx

    # Create Nginx config
    # We use port 3001 because that is what the production docker compose service maps to the host
    sudo tee /etc/nginx/sites-available/kci-mis > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/kci-mis /etc/nginx/sites-enabled/
    # Remove default site if it exists
    if [ -f /etc/nginx/sites-enabled/default ]; then
        sudo rm /etc/nginx/sites-enabled/default
    fi

    # Test and restart Nginx
    sudo nginx -t
    sudo systemctl restart nginx
else
    echo "Nginx is already installed. Skipping installation and configuration."
fi

echo "Your application is ready to run."
echo "You can start it with 'sudo docker compose up prod -d --build'."
