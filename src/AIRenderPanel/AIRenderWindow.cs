using System.Windows.Forms;
using Rhino;

namespace AIRenderPanel
{
    /// <summary>
    /// AI 渲染独立窗口 - 使用 WinForms Form 作为独立弹出窗口
    /// 点击命令时打开，关闭时隐藏（保持实例，快速重新打开）
    /// </summary>
    public class AIRenderWindow : Form
    {
        private static AIRenderWindow? _instance;
        private readonly AIRenderPanelHost _panelHost;

        /// <summary>
        /// 获取或创建窗口单例
        /// </summary>
        public static AIRenderWindow Instance
        {
            get
            {
                if (_instance == null || _instance.IsDisposed)
                {
                    _instance = new AIRenderWindow();
                }
                return _instance;
            }
        }

        /// <summary>
        /// 显示或激活窗口
        /// </summary>
        public static void ShowWindow()
        {
            var window = Instance;
            
            if (window.Visible)
            {
                // 如果已经显示，激活窗口（置于前台）
                window.Activate();
                if (window.WindowState == FormWindowState.Minimized)
                {
                    window.WindowState = FormWindowState.Normal;
                }
            }
            else
            {
                // 首次显示或从隐藏状态显示
                window.Show();
            }
            
            RhinoApp.WriteLine("[AI渲染] 窗口已打开");
        }

        /// <summary>
        /// 切换窗口显示状态
        /// </summary>
        public static void ToggleWindow()
        {
            var window = Instance;
            
            if (window.Visible)
            {
                window.Hide();
                RhinoApp.WriteLine("[AI渲染] 窗口已隐藏");
            }
            else
            {
                ShowWindow();
            }
        }

        private AIRenderWindow()
        {
            // 窗口属性
            Text = "SA&DAGA AI Render";
            Icon = LoadIcon();
            
            // 窗口尺寸
            Width = 1200;
            Height = 800;
            MinimumSize = new System.Drawing.Size(800, 600);
            
            // 窗口样式
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.Sizable;
            
            // 深色风格
            BackColor = System.Drawing.Color.FromArgb(20, 20, 22);
            
            // 创建面板内容
            _panelHost = new AIRenderPanelHost();
            _panelHost.Dock = DockStyle.Fill;
            Controls.Add(_panelHost);
            
            // 窗口关闭时隐藏而不是销毁（快速重新打开）
            FormClosing += OnFormClosing;
            
            RhinoApp.WriteLine("[AI渲染] 独立窗口已创建");
        }

        private void OnFormClosing(object? sender, FormClosingEventArgs e)
        {
            // 用户点击关闭按钮时，隐藏窗口而不是销毁
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                Hide();
                RhinoApp.WriteLine("[AI渲染] 窗口已隐藏（点击 AIRenderPanel 命令可重新打开）");
            }
        }

        private System.Drawing.Icon? LoadIcon()
        {
            try
            {
                var assembly = System.Reflection.Assembly.GetExecutingAssembly();
                using var stream = assembly.GetManifestResourceStream("AIRenderPanel.Resources.icon.png");
                if (stream != null)
                {
                    using var bitmap = new System.Drawing.Bitmap(stream);
                    var hIcon = bitmap.GetHicon();
                    return System.Drawing.Icon.FromHandle(hIcon);
                }
            }
            catch
            {
                // 加载失败使用默认图标
            }
            return null;
        }

        /// <summary>
        /// 打开开发者工具
        /// </summary>
        public void OpenDevTools()
        {
            _panelHost?.OpenDevTools();
        }

        /// <summary>
        /// 强制销毁窗口（插件卸载时调用）
        /// </summary>
        public static void DestroyWindow()
        {
            if (_instance != null && !_instance.IsDisposed)
            {
                _instance.FormClosing -= _instance.OnFormClosing;
                _instance.Close();
                _instance.Dispose();
                _instance = null;
                RhinoApp.WriteLine("[AI渲染] 窗口已销毁");
            }
        }
    }
}
