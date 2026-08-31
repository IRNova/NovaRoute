from setuptools import setup, find_packages

setup(
    name="novaroute",
    version="1.0.0",
    description="Python SDK for NovaRoute AI Gateway — unified interface to 369+ LLM providers",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="NovaRoute",
    author_email="support@novaroute.dev",
    url="https://github.com/novaroute/novaroute-python",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "requests>=2.28.0",
        "httpx>=0.24.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": ["pytest", "ruff", "mypy"],
        "streaming": ["sseclient-py>=0.0.27"],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    entry_points={
        "console_scripts": [
            "novaroute=novaroute.cli:main",
        ],
    },
)
