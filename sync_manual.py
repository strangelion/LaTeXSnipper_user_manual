#!/usr/bin/env python3
"""
sync_manual.py — 在 user_manual.typ 与 public/user_manual.typ 之间双向同步。

用法:
  python sync_manual.py          # 单向同步：根目录 → public（默认方向）
  python sync_manual.py --both   # 双向同步：按修改时间，较新的覆盖较旧的
  python sync_manual.py --watch  # 监听模式：检测到文件变更自动同步
  python sync_manual.py --reverse  # 反向同步：public → 根目录
  python sync_manual.py --diff   # 仅显示差异，不执行同步
"""

import os
import sys
import time
import hashlib
import argparse

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_manual.typ")
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "user_manual.typ")


def file_hash(path: str) -> str:
    """返回文件的 SHA256 哈希值。"""
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def file_mtime(path: str) -> float:
    """返回文件修改时间戳。"""
    return os.path.getmtime(path)


def sync_file(src: str, dst: str, dry_run: bool = False) -> bool:
    """将 src 复制到 dst（如果内容不同）。返回是否执行了复制。"""
    if not os.path.exists(src):
        print(f"❌ 源文件不存在: {src}")
        return False

    os.makedirs(os.path.dirname(dst), exist_ok=True)

    src_hash = file_hash(src)
    dst_hash = file_hash(dst) if os.path.exists(dst) else None

    if src_hash == dst_hash:
        return False  # 内容相同，无需同步

    if dry_run:
        print(f"  ⚡ 需要同步: {src} → {dst}")
        return True

    with open(src, "rb") as f:
        data = f.read()
    with open(dst, "wb") as f:
        f.write(data)
    return True


def show_diff(src: str, dst: str):
    """显示两个文件的差异摘要。"""
    src_hash = file_hash(src)
    dst_hash = file_hash(dst) if os.path.exists(dst) else None

    src_mtime = file_mtime(src)
    dst_mtime = file_mtime(dst) if os.path.exists(dst) else 0

    src_size = os.path.getsize(src)
    dst_size = os.path.getsize(dst) if os.path.exists(dst) else 0

    print(f"  📄 {src}")
    print(f"     修改时间: {time.ctime(src_mtime)}")
    print(f"     大小: {src_size:,} bytes")
    print(f"     SHA256: {src_hash[:16]}...")
    print()
    print(f"  📄 {dst}")
    if os.path.exists(dst):
        print(f"     修改时间: {time.ctime(dst_mtime)}")
        print(f"     大小: {dst_size:,} bytes")
        print(f"     SHA256: {dst_hash[:16]}...")
    else:
        print(f"     (文件不存在)")
    print()

    if os.path.exists(dst) and src_hash == dst_hash:
        print("  ✅ 内容一致，无需同步")
    else:
        newer = "根目录" if src_mtime >= dst_mtime else "public"
        print(f"  ⚠️  内容不同！较新的文件: {newer}")


def sync_bidirectional(file_a: str, file_b: str, dry_run: bool = False) -> bool:
    """双向同步：按修改时间，较新的覆盖较旧的。"""
    if not os.path.exists(file_a) or not os.path.exists(file_b):
        print("❌ 两个文件必须都存在才能做双向同步")
        return False

    if file_hash(file_a) == file_hash(file_b):
        return False  # 内容相同

    mtime_a = file_mtime(file_a)
    mtime_b = file_mtime(file_b)

    if mtime_a >= mtime_b:
        return sync_file(file_a, file_b, dry_run)
    else:
        return sync_file(file_b, file_a, dry_run)


def watch_mode():
    """监听文件变化，自动同步。"""
    import datetime

    print(f"👀 监听模式启动中...")
    print(f"  监视文件:")
    print(f"    {SRC}")
    print(f"    {DST}")
    print(f"  按 Ctrl+C 停止")
    print()

    last_src_hash = file_hash(SRC) if os.path.exists(SRC) else ""
    last_dst_hash = file_hash(DST) if os.path.exists(DST) else ""

    # 先做一次初始同步
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 执行初始同步...")
    synced = sync_bidirectional(SRC, DST)
    if synced:
        direction = "根目录 → public" if file_mtime(SRC) >= file_mtime(DST) else "public → 根目录"
        print(f"  ✅ 已同步 ({direction})")
    else:
        print(f"  ✅ 文件已一致")
    
    last_src_hash = file_hash(SRC)
    last_dst_hash = file_hash(DST)

    while True:
        time.sleep(1.5)

        current_src_hash = file_hash(SRC) if os.path.exists(SRC) else ""
        current_dst_hash = file_hash(DST) if os.path.exists(DST) else ""

        src_changed = current_src_hash != last_src_hash
        dst_changed = current_dst_hash != last_dst_hash

        if src_changed or dst_changed:
            now = datetime.datetime.now().strftime("%H:%M:%S")
            
            # 等待 0.5 秒，避免文件还在写入中
            time.sleep(0.5)

            if src_changed:
                print(f"[{now}] 检测到变更: 根目录 user_manual.typ")
                synced = sync_file(SRC, DST)
                if synced:
                    print(f"  ✅ 已同步到 public/user_manual.typ")
                else:
                    print(f"  ➡️  public 版本已是最新")
                last_src_hash = file_hash(SRC)

            if dst_changed:
                print(f"[{now}] 检测到变更: public/user_manual.typ")
                synced = sync_file(DST, SRC)
                if synced:
                    print(f"  ✅ 已同步到根目录 user_manual.typ")
                else:
                    print(f"  ➡️  根目录版本已是最新")
                last_dst_hash = file_hash(DST)

            # 更新另一个的 hash（因为同步后它也变了）
            if os.path.exists(SRC):
                last_src_hash = file_hash(SRC)
            if os.path.exists(DST):
                last_dst_hash = file_hash(DST)


def main():
    parser = argparse.ArgumentParser(
        description="在 user_manual.typ 与 public/user_manual.typ 之间同步",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python sync_manual.py             根目录 → public（单向）
  python sync_manual.py --both      双向（较新的覆盖较旧的）
  python sync_manual.py --watch     监听模式（推荐）
  python sync_manual.py --diff      查看差异
  python sync_manual.py --reverse   public → 根目录
        """,
    )
    parser.add_argument("--both", action="store_true", help="双向同步（较新的覆盖较旧的）")
    parser.add_argument("--reverse", action="store_true", help="反向同步（public → 根目录）")
    parser.add_argument("--watch", action="store_true", help="监听模式，文件变更自动同步")
    parser.add_argument("--diff", action="store_true", help="仅显示差异，不执行同步")
    parser.add_argument("--dry-run", action="store_true", help="预览模式，显示会做什么但不实际执行")

    args = parser.parse_args()

    # 验证文件存在
    if not os.path.exists(SRC):
        print(f"❌ 找不到文件: {SRC}")
        sys.exit(1)

    if not os.path.exists(DST):
        print(f"⚠️  目标文件不存在，将自动创建: {DST}")

    # --- diff 模式 ---
    if args.diff:
        print("=" * 50)
        print("📊 文件差异对比")
        print("=" * 50)
        print()
        show_diff(SRC, DST)
        return

    # --- watch 模式 ---
    if args.watch:
        watch_mode()
        return

    # --- 双向同步 ---
    if args.both:
        print("🔄 双向同步（较新的覆盖较旧的）...")
        synced = sync_bidirectional(SRC, DST, dry_run=args.dry_run)
        if synced:
            direction = "根目录 → public" if file_mtime(SRC) >= file_mtime(DST) else "public → 根目录"
            print(f"  ✅ 同步完成 ({direction})")
        else:
            print(f"  ✅ 文件已一致，无需同步")
        return

    # --- 反向同步 ---
    if args.reverse:
        print(f"🔄 同步: public/user_manual.typ → user_manual.typ")
        synced = sync_file(DST, SRC, dry_run=args.dry_run)
        if synced:
            print(f"  ✅ 同步完成")
        else:
            print(f"  ✅ 文件已一致，无需同步")
        return

    # --- 默认：根目录 → public ---
    print(f"🔄 同步: user_manual.typ → public/user_manual.typ")
    synced = sync_file(SRC, DST, dry_run=args.dry_run)
    if synced:
        print(f"  ✅ 同步完成")
    else:
        print(f"  ✅ 文件已一致，无需同步")


if __name__ == "__main__":
    main()
