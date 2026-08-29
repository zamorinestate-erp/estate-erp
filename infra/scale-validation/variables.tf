variable "aws_region" {
  description = "AWS region for the enterprise scale validation infrastructure"
  type        = String
  default     = "ap-south-1" # Mumbai region for lowest latency to Zamorin Cafe operations
}

variable "generator_ami_id" {
  description = "Ubuntu 22.04 LTS AMI for load generators"
  type        = String
  default     = "ami-03f4878e83434e158"
}

variable "target_api_replicas" {
  description = "Number of API container replicas (recommended start: 4, scale: 8-16)"
  type        = number
  default     = 4
}
