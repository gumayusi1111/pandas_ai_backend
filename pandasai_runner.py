#!/usr/bin/env python
"""
Runner script for PandasAI to Pandas code generation.
This script is called by the Node.js backend.
"""

import os
import sys
import json
import pandas as pd
import uuid
import shutil
from datetime import datetime
from dotenv import load_dotenv
from pandasai import Agent
from pandasai.llm.local_llm import LocalLLM
import argparse

# Redirect print to stderr to avoid interfering with JSON output
def debug_print(*args, **kwargs):
    """Print debug messages to stderr instead of stdout"""
    print(*args, file=sys.stderr, **kwargs)

# Use non-interactive matplotlib backend
import matplotlib
matplotlib.use('Agg')

# Configure matplotlib for Chinese text support
matplotlib.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'Microsoft YaHei', 'WenQuanYi Micro Hei']
matplotlib.rcParams['axes.unicode_minus'] = False

# Load environment variables
load_dotenv(override=True)
# API_KEY = os.getenv("DEEPSEEK_API_KEY") # Will be set based on args or env
# API_BASE = os.getenv("DEEPSEEK_API_BASE") # Will be set based on args or env

# Dictionary of file readers for different formats
FILE_READERS = {
    'csv': pd.read_csv,
    'xlsx': pd.read_excel,
    'xls': pd.read_excel,
    'json': pd.read_json,
    'parquet': pd.read_parquet,
    'feather': pd.read_feather,
    'pickle': lambda f: pd.read_pickle(f),
    'pkl': lambda f: pd.read_pickle(f)
}

# Chart path
CHARTS_DIR = os.path.join(os.getcwd(), 'charts')
if not os.path.exists(CHARTS_DIR):
    os.makedirs(CHARTS_DIR, exist_ok=True)

def clean_pandasai_code(code, preference='default'):
    """
    Clean PandasAI generated code by removing result formatting parts.
    """
    if not code:
        return code
    
    # Standard code cleaning
    if "result = {" in code:
        lines = code.split("\n")
        result_line_index = -1
        
        # Find the line with result dictionary
        for i, line in enumerate(lines):
            if "result = {" in line:
                result_line_index = i
                break
        
        if result_line_index >= 0:
            # Keep code before result line
            cleaned_code = "\n".join(lines[:result_line_index])
            
            # If the last line is data processing logic, add print statement
            last_line = cleaned_code.strip().split("\n")[-1]
            
            # Check if the last line contains a variable assignment we can print
            if "=" in last_line and not last_line.strip().startswith("#") and not any(keyword in last_line for keyword in ["if", "for", "while", "def", "class"]):
                var_name = last_line.split("=")[0].strip()
                if var_name and not var_name.startswith("#"):
                    cleaned_code += f"\n\n# Print result\nprint({var_name})"
            
            # Add appropriate note based on preference
            if preference == 'standard_pandas':
                cleaned_code += "\n\n# The above is standard Pandas code that can be run directly in Python."
            else:
                cleaned_code += "\n\n# Note: PandasAI result formatting code has been removed.\n# Above is standard Pandas code that can be run directly in Python."
            
            # Ensure standard pandas imports
            if preference == 'standard_pandas' and 'import pandas' not in cleaned_code:
                cleaned_code = "import pandas as pd\n\n" + cleaned_code
            
            # Check for matplotlib code and ensure imports
            if 'plt.' in cleaned_code and 'import matplotlib' not in cleaned_code:
                cleaned_code = "import matplotlib.pyplot as plt\n" + cleaned_code
            
            return cleaned_code.strip()
    
    # If no result dictionary found, return original code
    return code

# Class to capture matplotlib plots
class PlotCapture:
    def __init__(self):
        self.has_plot = False
        self.chart_path = None
    
    def on_plot_generated(self, chart_path):
        self.has_plot = True
        # Copy the chart to our charts directory with a timestamped filename
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        new_filename = f"chart_{timestamp}_{unique_id}.png"
        self.chart_path = os.path.join(CHARTS_DIR, new_filename)
        
        try:
            # 确保chart_path存在且可以读取
            if not os.path.exists(chart_path):
                debug_print(f"Error: Source chart path does not exist: {chart_path}")
                return
            
            # 使用shutil.copy2复制文件，保留元数据
            shutil.copy2(chart_path, self.chart_path)
            debug_print(f"Chart saved to {self.chart_path}")
            
            # 确认文件已成功复制
            if not os.path.exists(self.chart_path):
                debug_print("Error: Chart could not be copied to destination")
                self.chart_path = None
            else:
                # 设置适当的文件权限
                os.chmod(self.chart_path, 0o644)
        except Exception as e:
            debug_print(f"Error copying chart: {str(e)}")
            self.chart_path = None

def generate_pandas_code(file_path, query, cli_model_name=None, preference="default", cli_api_key=None, cli_api_base_url=None):
    """
    Generate pandas code using PandasAI.
    Preference can be 'default' or 'standard_pandas'
    """
    # Determine active configuration
    active_api_key = cli_api_key if cli_api_key else os.getenv("DEEPSEEK_API_KEY")
    active_api_base = cli_api_base_url if cli_api_base_url else os.getenv("DEEPSEEK_API_BASE")
    active_model_name = cli_model_name if cli_model_name else "deepseek-chat" # Default if nothing is passed

    result = {
        'timestamp': datetime.now().isoformat(),
        'code': None,
        'error': None,
        'tokens': 0,
        'query': query,
        'model': active_model_name, # Use active model name
        'preference': preference,
        'config_source': 'cli' if cli_api_key or cli_api_base_url or cli_model_name else 'env'
    }
    
    # Validate model name (can be dynamic based on provider, for now keep existing validation or make it more flexible)
    # For now, we assume the model passed via CLI is valid for the given custom provider.
    # If using environment variables, stick to a predefined list.
    if not cli_model_name and active_model_name not in ["deepseek-chat", "deepseek-r1"]: # Keep old validation if using env defaults
         result['error'] = f"Invalid environment default model name. Choose from: deepseek-chat, deepseek-r1"
         return result
    
    # Check API keys if they are supposed to come from env (i.e., not overridden by CLI)
    if not active_api_key or not active_api_base:
        result['error'] = "API key or base URL not found. Provide them via CLI arguments or environment variables."
        return result
    
    # Use sample data if no file is provided
    if file_path == 'none' or not os.path.exists(file_path):
        debug_print("Using sample dataset")
        # Create a sample dataset
        sample_df_data = {
            "Product": ["Laptop", "Phone", "Tablet", "Watch", "Headphones", "Console", "Monitor"],
            "Sales": [120, 250, 180, 300, 450, 90, 150],
            "Price": [5000, 3000, 2000, 1500, 500, 2500, 1800],
            "Category": ["Electronics", "Electronics", "Electronics", "Wearable", "Audio", "Gaming", "Electronics"]
        }
        df = pd.DataFrame(sample_df_data)
    else:
        # Load data based on file extension
        try:
            file_ext = os.path.splitext(file_path)[1][1:].lower()
            
            if file_ext in FILE_READERS:
                debug_print(f"Reading file with {file_ext} format")
                reader_func = FILE_READERS[file_ext]
                df = reader_func(file_path)
            else:
                # Default to CSV if extension not recognized
                debug_print(f"Unknown file format '{file_ext}', trying as CSV")
                df = pd.read_csv(file_path)
                
            debug_print(f"Successfully loaded data: {df.shape[0]} rows, {df.shape[1]} columns")
            
        except Exception as e:
            result['error'] = f"Error loading file: {str(e)}"
            return result
    
    # Initialize LLM and PandasAI Agent
    try:
        debug_print(f"Initializing LLM with model {active_model_name}, API Base: {active_api_base[:20]}...") # Use active model name
        llm = LocalLLM(
            api_key=active_api_key, # Use active API key
            api_base=active_api_base, # Use active API base
            model=active_model_name # Use active model name
        )
        
        # Create a plot capture handler
        plot_capture = PlotCapture()
        
        # Create prompting based on preference
        prompt_prefix = ""
        if preference == 'standard_pandas':
            prompt_prefix = "Generate standard Pandas code (not PandasAI specific code). "
            prompt_prefix += "Make sure to include all necessary imports. Focus on basic pandas operations. "
            prompt_prefix += "Show the complete code solution and make sure it's executable. "
        
        # Modify query based on preference
        enhanced_query = query
        if prompt_prefix:
            enhanced_query = f"{prompt_prefix}Query: {query}"
        
        # PandasAI configuration - enable chart saving
        config = {
            "llm": llm, 
            "verbose": False, 
            "save_logs": False,
            "enforce_privacy": False,
            "enable_cache": True,
            "use_error_correction_framework": False,
            "save_charts": True,  # Enable chart saving
            "save_charts_path": CHARTS_DIR,
            "custom_whitelisted_dependencies": ["matplotlib.pyplot", "numpy", "matplotlib.rcParams"]
        }
        
        pandas_ai_agent = Agent([df], config=config)
        
        # Connect to plot generation events
        if hasattr(pandas_ai_agent, 'add_chart_handler'):
            pandas_ai_agent.add_chart_handler(plot_capture.on_plot_generated)
        
        # Run the query
        debug_print(f"Sending query: '{enhanced_query}'")
        response = pandas_ai_agent.chat(enhanced_query)
        
        # Get the generated code
        if hasattr(pandas_ai_agent, 'last_code_executed'):
            raw_code = pandas_ai_agent.last_code_executed
            
            debug_print(f"Raw code from LLM:\n{raw_code}")
            
            # Clean the code to remove PandasAI result formatting
            cleaned_code = clean_pandasai_code(raw_code, preference)
            
            result['code'] = cleaned_code
            
            # Add information about chart if one was generated
            if plot_capture.has_plot and plot_capture.chart_path:
                result['chart'] = os.path.basename(plot_capture.chart_path)
                debug_print(f"Generated chart: {result['chart']}")
            
            # Estimate tokens count
            if cleaned_code:
                char_count = len(cleaned_code)
                line_count = cleaned_code.count('\n') + 1
                estimated_tokens = int(char_count * 0.25 + line_count * 5)
                result['tokens'] = estimated_tokens
                debug_print(f"Generated code estimated to contain {estimated_tokens} tokens")
            
            debug_print("Successfully generated and cleaned code")
        else:
            result['error'] = "No code was generated"
            debug_print("No code was generated")
            
    except Exception as e:
        result['error'] = f"Error during code generation: {str(e)}"
        debug_print(f"Error during code generation: {str(e)}")
    
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PandasAI Runner Script")
    parser.add_argument("query", help="The query/question to ask PandasAI.")
    parser.add_argument("file_path", help="Path to the data file (or 'none' for sample data).")
    parser.add_argument("--model-name", help="Name of the AI model to use (e.g., deepseek-chat). Overrides active config from backend.")
    parser.add_argument("--preference", default="default", help="Preference for code generation ('default' or 'standard_pandas').")
    parser.add_argument("--api-key", help="API key for the AI provider. Overrides active config from backend.")
    parser.add_argument("--api-base-url", help="API base URL for the AI provider. Overrides active config from backend.")

    args = parser.parse_args()

    # Call generate_pandas_code with the parsed arguments
    # Pass model_name explicitly, it will be handled inside generate_pandas_code
    result = generate_pandas_code(
        args.file_path, 
        args.query, 
        cli_model_name=args.model_name, # Pass CLI model name
        preference=args.preference,
        cli_api_key=args.api_key,       # Pass CLI API key
        cli_api_base_url=args.api_base_url # Pass CLI API base URL
    )
    
    # Only output the JSON result to stdout
    print(json.dumps(result)) 