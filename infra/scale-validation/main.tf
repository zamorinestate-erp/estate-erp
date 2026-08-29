terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.10"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ZamorinCafeERP"
      Purpose     = "EnterpriseScaleValidation"
      Environment = "ScalabilityStaging"
      Owner       = "Zamorin"
      AutoCleanup = "True"
    }
  }
}

# -----------------------------------------------------------------------------
# VPC & NETWORKING
# -----------------------------------------------------------------------------
resource "aws_vpc" "scale_vpc" {
  cidr_block           = "10.100.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "zamorin-scale-validation-vpc"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.scale_vpc.id
  cidr_block              = "10.100.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "zamorin-scale-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.scale_vpc.id
  cidr_block              = "10.100.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = { Name = "zamorin-scale-public-b" }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.scale_vpc.id
  cidr_block        = "10.100.10.0/24"
  availability_zone = "${var.aws_region}a"

  tags = { Name = "zamorin-scale-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.scale_vpc.id
  cidr_block        = "10.100.11.0/24"
  availability_zone = "${var.aws_region}b"

  tags = { Name = "zamorin-scale-private-b" }
}

# -----------------------------------------------------------------------------
# APPLICATION LOAD BALANCER (SSE & HTTP/2 CONFIGURED)
# -----------------------------------------------------------------------------
resource "aws_lb" "scale_alb" {
  name               = "zamorin-scale-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  idle_timeout               = 120 # Accommodates 30s jittered SSE heartbeats
  enable_http2               = true
  drop_invalid_header_fields = true

  tags = { Name = "zamorin-scale-alb" }
}

resource "aws_security_group" "alb_sg" {
  name        = "zamorin-scale-alb-sg"
  description = "Allow inbound HTTPS/HTTP for scale validation"
  vpc_id      = aws_vpc.scale_vpc.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb_target_group" "api_tg" {
  name        = "zamorin-scale-api-tg"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.scale_vpc.id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  deregistration_delay = 30
}

# -----------------------------------------------------------------------------
# REDIS CLUSTER (AWS ELASTICACHE)
# -----------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "zamorin-scale-redis-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_elasticache_replication_group" "scale_redis" {
  replication_group_id          = "zamorin-scale-redis"
  description                   = "Enterprise Scale Validation Redis Cluster"
  node_type                     = "cache.m6g.large"
  num_cache_clusters            = 2
  port                          = 6379
  parameter_group_name          = "default.redis7"
  subnet_group_name             = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids            = [aws_security_group.redis_sg.id]
  at_rest_encryption_enabled    = true
  transit_encryption_enabled   = false
  automatic_failover_enabled    = true
}

resource "aws_security_group" "redis_sg" {
  name   = "zamorin-scale-redis-sg"
  vpc_id = aws_vpc.scale_vpc.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# -----------------------------------------------------------------------------
# ECS CLUSTER (API SERVERS: 4 -> 16 REPLICAS)
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "scale_cluster" {
  name = "zamorin-scale-cluster"
}

resource "aws_security_group" "api_sg" {
  name   = "zamorin-scale-api-sg"
  vpc_id = aws_vpc.scale_vpc.id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# -----------------------------------------------------------------------------
# DISTRIBUTED LOAD GENERATOR FLEET (5 x c6i.2xlarge)
# -----------------------------------------------------------------------------
resource "aws_instance" "load_generators" {
  count                  = 5
  ami                    = var.generator_ami_id
  instance_type          = "c6i.2xlarge" # 8 vCPU, 16 GB RAM, 12.5 Gbps network
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.alb_sg.id]

  tags = {
    Name = "zamorin-scale-load-gen-${count.index + 1}"
  }
}
